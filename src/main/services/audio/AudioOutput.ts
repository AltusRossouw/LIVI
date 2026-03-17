import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { DEBUG } from '@main/constants'
import { app } from 'electron'
import os from 'os'
import fs from 'fs'
import path from 'path'

export interface AudioOutputOptions {
  sampleRate: number
  channels: number
}

export class AudioOutput {
  private process: ChildProcessWithoutNullStreams | null = null
  private readonly sampleRate: number
  private readonly channels: number

  private bytesWritten = 0
  private queue: Buffer[] = []
  private writing = false

  constructor(opts: AudioOutputOptions) {
    this.sampleRate = opts.sampleRate
    this.channels = Math.max(1, opts.channels | 0)

    if (DEBUG) {
      console.debug('[AudioOutput] Init', {
        sampleRate: this.sampleRate,
        channels: this.channels,
        platform: os.platform()
      })
    }
  }

  start(): void {
    this.stop()

    let cmd: string
    let args: string[]
    const env = { ...process.env, PATH: AudioOutput.buildExecPath(process.env.PATH) }

    if (os.platform() === 'linux') {
      cmd = 'pw-play'
      args = [
        '--raw',
        '--rate',
        this.sampleRate.toString(),
        '--channels',
        this.channels.toString(),
        '-' // stdin
      ]
    } else if (os.platform() === 'darwin') {
      const gstRoot = AudioOutput.resolveGStreamerRoot()
      if (!gstRoot) {
        console.error('[AudioOutput] Bundled GStreamer not found')
        return
      }

      cmd = path.join(gstRoot, 'bin', 'gst-launch-1.0')
      args = [
        'fdsrc',
        'fd=0',
        '!',
        'rawaudioparse',
        'format=pcm',
        'pcm-format=s16le',
        `sample-rate=${this.sampleRate}`,
        `num-channels=${this.channels}`,
        '!',
        'audioconvert',
        '!',
        'audioresample',
        '!',
        'autoaudiosink'
      ]
    } else if (os.platform() === 'win32') {
      const ffplayPath = AudioOutput.resolveFfplayPath()
      if (!ffplayPath) {
        console.error('[AudioOutput] ffplay not found (expected resources/bin/ffplay.exe)')
        return
      }

      cmd = ffplayPath
      args = [
        '-nodisp',
        '-loglevel',
        'warning',
        '-fflags',
        'nobuffer',
        '-flags',
        'low_delay',
        '-probesize',
        '32',
        '-analyzeduration',
        '0',
        '-f',
        's16le',
        '-ar',
        this.sampleRate.toString(),
        '-ch_layout',
        AudioOutput.ffplayChannelLayout(this.channels),
        '-i',
        'pipe:0'
      ]
    } else {
      console.error('[AudioOutput] Platform not supported for audio output')
      return
    }

    if (DEBUG) {
      console.debug('[AudioOutput] Spawning', cmd, args.join(' '))
    }
    this.bytesWritten = 0
    this.queue = []
    this.writing = false

    let spawnEnv = os.platform() === 'win32' ? process.env : env

    if (os.platform() === 'darwin') {
      const gstRoot = AudioOutput.resolveGStreamerRoot()
      if (gstRoot) {
        spawnEnv = {
          ...spawnEnv,
          DYLD_LIBRARY_PATH: path.join(gstRoot, 'lib'),
          GST_PLUGIN_SYSTEM_PATH_1_0: path.join(gstRoot, 'lib', 'gstreamer-1.0'),
          GST_PLUGIN_SCANNER: path.join(gstRoot, 'libexec', 'gstreamer-1.0', 'gst-plugin-scanner')
        }
      }
    }

    this.process = spawn(cmd, args, { env: spawnEnv, shell: false })

    const proc = this.process
    const stdin = proc.stdin

    stdin.on('error', (err) => {
      if (DEBUG) console.warn('[AudioOutput] stdin error:', err.message)
    })
    stdin.on('drain', () => this.flushQueue())

    proc.stderr.on('data', (d: Buffer) => {
      const s = d.toString().trim()
      if (s && DEBUG) console.warn('[AudioOutput] STDERR:', s)
    })
    proc.on('error', (err) => {
      if (DEBUG) console.error('[AudioOutput] process error:', err)
      this.cleanup()
    })
    proc.on('close', (code, signal) => {
      if (DEBUG) {
        console.debug('[AudioOutput] process exited', {
          code,
          signal,
          bytesWritten: this.bytesWritten
        })
      }
      this.cleanup()
    })

    if (DEBUG) {
      console.debug('[AudioOutput] playback started')
    }
  }

  private flushQueue(): void {
    const proc = this.process
    if (!proc || !proc.stdin || proc.stdin.destroyed) {
      this.queue = []
      this.writing = false
      return
    }

    const stdin = proc.stdin
    this.writing = true

    while (this.queue.length > 0) {
      const buf = this.queue.shift()!
      const ok = stdin.write(buf)
      this.bytesWritten += buf.byteLength
      if (!ok) return
    }

    this.writing = false
  }

  write(chunk: Int16Array | Buffer | undefined | null): void {
    const proc = this.process
    if (!proc || !proc.stdin || proc.stdin.destroyed) return
    if (!chunk) return

    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)

    this.queue.push(buf)
    if (!this.writing) this.flushQueue()
  }

  stop(): void {
    if (!this.process) return
    try {
      if (this.process.stdin && !this.process.stdin.destroyed) {
        this.process.stdin.end()
      }
    } catch (e) {
      if (DEBUG) console.warn('[AudioOutput] failed to end stdin:', e)
    }
    try {
      this.process.kill()
    } catch (e) {
      if (DEBUG) console.warn('[AudioOutput] failed to kill process:', e)
    }
    this.cleanup()
  }

  dispose(): void {
    this.stop()
  }

  private cleanup(): void {
    this.queue = []
    this.writing = false
    this.process = null
  }

  private static resolveGStreamerRoot(): string | null {
    const isPackaged = app.isPackaged
    const base = isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'assets')
    const bundled = path.join(base, 'gstreamer', 'darwin')

    return fs.existsSync(bundled) ? bundled : null
  }

  private static resolveFfplayPath(): string | null {
    const bundled = path.join(process.resourcesPath, 'bin', 'ffplay.exe')
    return fs.existsSync(bundled) ? bundled : null
  }

  private static buildExecPath(current?: string): string {
    const extra = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
    const set = new Set<string>([...extra, ...(current ? current.split(':') : [])])
    return Array.from(set).join(':')
  }

  private static ffplayChannelLayout(channels: number): string {
    switch (channels | 0) {
      case 1:
        return 'mono'
      case 2:
        return 'stereo'
      case 4:
        return 'quad'
      case 6:
        return '5.1'
      case 8:
        return '7.1'
      default:
        throw new Error(`[AudioOutput] Unsupported channel count for ffplay: ${channels}`)
    }
  }
}
