import { decodeTypeMap } from '../../../../main/carplay/messages'
import { AudioPlayerKey } from './types'
import { RingBuffer } from 'ringbuf.js'
import { createAudioPlayerKey } from './utils'
import type { Command } from './types'

type PortAudioLike = {
  type?: 'audio'
  buffer?: ArrayBuffer
  data?: Int16Array
  chunk?: ArrayBuffer
}

type AudioDataMsg = PortAudioLike & {
  decodeType?: number
  audioType?: number
}

type Key = AudioPlayerKey

const audioBuffers: Record<Key, RingBuffer> = {}
const pendingChunks: Record<Key, Int16Array[]> = {}
const sabRequested: Record<Key, boolean> = {}

let audioPort: MessagePort | undefined

type Info = { codec: string | number; sampleRate: number; channels: number; bitDepth?: number }
const lastInfo: Record<Key, Info> = {}
let currentKey: Key | undefined

function toInt16(msg: unknown): Int16Array | undefined {
  if (typeof msg === 'object' && msg !== null) {
    const a = msg as PortAudioLike
    if (a.data instanceof Int16Array) {
      const src = a.data
      const aligned =
        src.byteOffset % 2 === 0 && src.buffer.byteLength >= src.byteOffset + src.byteLength
      return aligned ? src : new Int16Array(src)
    }
    if (a.buffer instanceof ArrayBuffer) return new Int16Array(a.buffer)
    if (a.chunk instanceof ArrayBuffer) return new Int16Array(a.chunk)
  }
  console.error('[CARPLAY.WORKER] PCM - cannot interpret PCM data:', msg)
  return undefined
}

function requestSabIfNeeded(decodeType: number, audioType: number, key: Key) {
  if (!audioBuffers[key] && !sabRequested[key]) {
    ;(self as unknown as Worker).postMessage({
      type: 'requestBuffer',
      message: { decodeType, audioType }
    })
    sabRequested[key] = true
  }
}

function pushOrPend(key: Key, chunk: Int16Array) {
  const rb = audioBuffers[key]
  if (rb) rb.push(chunk)
  else {
    if (!pendingChunks[key]) pendingChunks[key] = []
    pendingChunks[key].push(chunk)
  }
}

function processAudioData(audioData: AudioDataMsg) {
  const decodeType = audioData.decodeType
  const audioType = audioData.audioType

  // Fallbacks bleiben wie gehabt, nur sauber typisiert
  const key = createAudioPlayerKey(
    typeof decodeType === 'number' ? decodeType : (undefined as unknown as number),
    typeof audioType === 'number' ? audioType : (undefined as unknown as number)
  )

  const meta = typeof decodeType === 'number' ? decodeTypeMap[decodeType] : undefined
  const channels = Math.max(1, meta?.channel ?? 2)
  const sampleRate = Math.max(8000, meta?.frequency ?? 48000)
  const codec = meta?.format ?? meta?.mimeType ?? String(decodeType)
  const bitDepth = meta?.bitDepth

  const pcm = toInt16(audioData)
  if (!pcm) return

  if (typeof decodeType === 'number' && typeof audioType === 'number') {
    requestSabIfNeeded(decodeType, audioType, key)
  }

  const info: Info = { codec, sampleRate, channels, bitDepth }
  const keyChanged = key !== currentKey
  const changed =
    !lastInfo[key] ||
    lastInfo[key].sampleRate !== info.sampleRate ||
    lastInfo[key].channels !== info.channels ||
    lastInfo[key].codec !== info.codec ||
    lastInfo[key].bitDepth !== info.bitDepth

  if (keyChanged || changed) {
    currentKey = key
    lastInfo[key] = info
    ;(self as unknown as Worker).postMessage({ type: 'audioInfo', payload: info })
  }

  // FFT downmix bleibt unverändert
  {
    const frames = Math.floor(pcm.length / channels)
    const f32 = new Float32Array(frames)
    for (let i = 0; i < frames; i++) {
      let s = 0
      for (let c = 0; c < channels; c++) s += pcm[i * channels + c] || 0
      f32[i] = s / channels / 32768
    }
    ;(self as unknown as Worker).postMessage({ type: 'pcmData', payload: f32.buffer, decodeType }, [
      f32.buffer
    ])
  }

  pushOrPend(key, pcm)
}

function setupPorts(port: MessagePort) {
  try {
    port.onmessage = (ev: MessageEvent<AudioDataMsg>) => {
      try {
        const data = ev.data
        if (data?.type === 'audio' && (data.buffer || data.data || data.chunk)) {
          processAudioData(data)
        }
      } catch (e) {
        console.error('[CARPLAY.WORKER] error processing audio message:', e)
      }
    }
    port.start?.()
  } catch (e) {
    console.error('[CARPLAY.WORKER] port setup failed:', e)
    ;(self as unknown as Worker).postMessage({ type: 'failure', error: 'Port setup failed' })
  }
}

;(self as unknown as Worker).onmessage = (ev: MessageEvent<Command>) => {
  const data = ev.data
  switch (data?.type) {
    case 'initialise': {
      const p = (data as Extract<Command, { type: 'initialise' }>).payload
      audioPort = p?.audioPort
      if (audioPort) setupPorts(audioPort)
      else console.error('[CARPLAY.WORKER] missing audioPort in initialise payload')
      break
    }
    case 'audioPlayer': {
      const p = (data as Extract<Command, { type: 'audioPlayer' }>).payload
      const { sab, decodeType, audioType } = p
      const key = createAudioPlayerKey(decodeType, audioType)
      audioBuffers[key] = new RingBuffer(sab, Int16Array)
      sabRequested[key] = false

      const pend = pendingChunks[key] || []
      if (pend.length) {
        for (const chunk of pend) audioBuffers[key].push(chunk)
        delete pendingChunks[key]
      }
      break
    }
    case 'stop': {
      Object.keys(audioBuffers).forEach((k) => delete audioBuffers[k as Key])
      Object.keys(pendingChunks).forEach((k) => delete pendingChunks[k as Key])
      Object.keys(sabRequested).forEach((k) => delete sabRequested[k as Key])
      Object.keys(lastInfo).forEach((k) => delete lastInfo[k as Key])
      currentKey = undefined
      break
    }
    default:
      break
  }
}

export {}
