const { NALUStream } = require('../h264-utils')
const h264tools = require('../h264-utils')

function makeArray(str) {
  if (typeof str !== 'string') str = str.join(' ')
  return new Uint8Array(str.match(/[\da-f]{2} */gi).map((s) => parseInt(s, 16)))
}

/* avc1.42C01E baseline, then avc1.640029 high, (then avc1.4D401E main)  */

const axb4 = makeArray(
  '00 00 00 01 09 10   00 00 00 01 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8  00 00 00 01 68 ce 38 80  00 00 00 01 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80  00 00 00 01 06 05 e8 cb b2 13 92 98 73 43 da a8 a6 c7 42 98 35 6c f5 73 72 63 3a 33 20 68 3a 34 38 30 20 77 3a 36 34 30 20 66 70 73 3a 33 30 2e 30 30 30 20 70 66 3a 36 36 20 6c 76 6c 3a 38 20 62 3a 30 20 62 71 70 3a 33 20 67 6f 70 3a 36 30 20 69 64 72 3a 36 30 20 73 6c 63 3a 35 20 63 6d 70 3a 30 20 72 63 3a 31 20 71 70 3a 32 36 20 72 61 74 65 3a 32 35 30 30 30 30 20 70 65 61 6b 3a 30 20 62 75 66 66 3a 39 33 37 35 30 20 72 65 66 3a 31 20 73 72 63 68 3a 33 32 20 61 73 72 63 68 3a 31 20 73 75 62 70 3a 31 20 70 61 72 3a 36 20 33 20 33 20 72 6e 64 3a 30 20 63 61 62 61 63 3a 30 20 6c 70 3a 30 20 63 74 6e 74 3a 30 20 61 75 64 3a 31 20 6c 61 74 3a 31 20 77 72 6b 3a 31 20 76 75 69 3a 31 20 6c 79 72 3a 31 20 3c 3c 00 80'
)
const axb3 = makeArray(
  '00 00 01 09 10 00 00 01 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8 00 00 01 68 ce 38 80 00 00 01 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 00 00 01 06 05 e8 cb b2 13 92 98 73 43 da a8 a6 c7 42 98 35 6c f5 73 72 63 3a 33 20 68 3a 34 38 30 20 77 3a 36 34 30 20 66 70 73 3a 33 30 2e 30 30 30 20 70 66 3a 36 36 20 6c 76 6c 3a 38 20 62 3a 30 20 62 71 70 3a 33 20 67 6f 70 3a 36 30 20 69 64 72 3a 36 30 20 73 6c 63 3a 35 20 63 6d 70 3a 30 20 72 63 3a 31 20 71 70 3a 32 36 20 72 61 74 65 3a 32 35 30 30 30 30 20 70 65 61 6b 3a 30 20 62 75 66 66 3a 39 33 37 35 30 20 72 65 66 3a 31 20 73 72 63 68 3a 33 32 20 61 73 72 63 68 3a 31 20 73 75 62 70 3a 31 20 70 61 72 3a 36 20 33 20 33 20 72 6e 64 3a 30 20 63 61 62 61 63 3a 30 20 6c 70 3a 30 20 63 74 6e 74 3a 30 20 61 75 64 3a 31 20 6c 61 74 3a 31 20 77 72 6b 3a 31 20 76 75 69 3a 31 20 6c 79 72 3a 31 20 3c 3c 00 80'
)

test('NALUStream constructor in Annex B, short stream, 4 byte sentinels, iterator with raw', () => {
  /* four packets, four-byte sentinels: this stream is pure nonsense h264-wise */
  const data = makeArray(
    '00 00 00 01 01 02 03 04 01    00 00 00 01  01 02 03 04 02    00 00 00 01 01 02 03 04 03    00 00 00 01 01 02 03 04 04'
  )

  const stream = new h264tools.NALUStream(data)
  expect(stream.type).toEqual('annexB')
  expect(stream.boxSizeMinusOne).toEqual(3)

  let count = 0
  for (const n of stream.nalus()) {
    const { nalu, rawNalu } = n
    expect(nalu.length).toEqual(5)
    expect(rawNalu.length - stream.boxSize).toEqual(5)
    expect(nalu[nalu.length - 1]).toEqual(count + 1)
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in Annex B, short stream, 3 byte sentinels, raw Nalus from iterator', () => {
  /* four packets, four-byte sentinels: this stream is pure nonsense h264-wise */
  const data = makeArray(
    '   00 00 01 01 02 03 04 01       00 00 01  01 02 03 04 02       00 00 01 01 02 03 04 03       00 00 01 01 02 03 04 04'
  )

  const stream = new h264tools.NALUStream(data)
  expect(stream.type).toEqual('annexB')
  expect(stream.boxSizeMinusOne).toEqual(2)
  expect(stream.packetCount).toEqual(4)
  let count = 0
  for (const n of stream.nalus()) {
    const { nalu, rawNalu } = n
    expect(nalu.length).toEqual(5)
    expect(rawNalu.length - stream.boxSize).toEqual(5)
    expect(nalu[nalu.length - 1]).toEqual(count + 1)
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in Annex B, short stream, varying length sentinels, raw Nalus from iterator', () => {
  /* four packets, this stream is pure nonsense h264-wise */
  const data = makeArray(
    '   00 00 01 01 02 03 04 01    00 00 00 01  01 02 03 04 02       00 00 01 01 02 03 04 03    00 00 00 01 01 02 03 04 04'
  )

  const stream = new h264tools.NALUStream(data)
  expect(stream.type).toEqual('annexB')
  expect(stream.packetCount).toEqual(4)
  const packets = stream.packets
  expect(packets).toBeDefined()
  expect(packets.length).toEqual(4)
  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i]
    expect(packet.length).toEqual(5)
    expect(packet[packet.length - 1]).toEqual(1 + i)
  }
  let count = 0
  for (const n of stream.nalus()) {
    const { nalu } = n
    expect(nalu.length).toEqual(5)
    expect(nalu[nalu.length - 1]).toEqual(count + 1)
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in Annex B with 4 byte sentinels, longer, raw Nalus from iterator', () => {
  const stream = new h264tools.NALUStream(axb4)
  expect(stream.type).toEqual('annexB')
  expect(stream.packetCount).toEqual(5)
  let count = 0
  for (const _ of stream.nalus()) {
    count++
  }
  expect(count).toEqual(stream.packetCount)
})
test('NALUStream constructor in Annex B with 3 byte sentinels, longer, raw Nalus from iterator', () => {
  const stream = new h264tools.NALUStream(axb3)
  expect(stream.type).toEqual('annexB')
  expect(stream.packetCount).toEqual(5)
  let count = 0
  for (const _ of stream.nalus()) {
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in packet mode, boxSize = 3, raw Nalus from iterator', () => {
  const bits = makeArray(
    '00 00 02    09 10      00 00 17 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8     00 00 04 68 ce 38 80     00 00 33 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 '
  )
  const stream = new h264tools.NALUStream(bits, { type: 'packet' })
  expect(stream.packetCount).toEqual(4)
  expect(stream.type).toEqual('packet')
  expect(stream.boxSizeMinusOne).toEqual(2)
  let count = 0
  for (const _ of stream.nalus()) {
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in packet mode, boxSize = 4, raw Nalus from iterator', () => {
  const bits = makeArray(
    '00 00 00 02 09 10   00 00 00 17 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8  00 00 00 04 68 ce 38 80  00 00 00 33 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 '
  )
  const stream = new h264tools.NALUStream(bits, { type: 'packet' })
  expect(stream.packetCount).toEqual(4)
  expect(stream.type).toEqual('packet')
  expect(stream.boxSizeMinusOne).toEqual(3)
  let count = 0
  for (const _ of stream.nalus()) {
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('NALUStream constructor in packet mode, boxSize = 3, extra data at end, raw Nalus from iterator', () => {
  const bits = makeArray(
    '00 00 02    09 10      00 00 17 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8     00 00 04 68 ce 38 80     00 00 33 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 de ad be ef'
  )
  const stream = new h264tools.NALUStream(bits, { type: 'packet' })
  expect(stream.packetCount).toEqual(4)

  let count = 0
  for (const _ of stream.nalus()) {
    count++
  }
  expect(count).toEqual(stream.packetCount)
})

test('getType returns preset type and boxSize immediately', () => {
  const stream = new NALUStream(new Uint8Array([0x00, 0x00, 0x00, 0x02, 0x65, 0x88]), {
    type: 'packet',
    boxSize: 4
  })

  expect(stream.getType(4)).toEqual({ type: 'packet', boxSize: 4 })
})

test('Symbol.iterator hits fallback object on first nextPacket call', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  const iter = stream[Symbol.iterator]()
  expect(iter.next()).toEqual({ value: undefined, done: true })
  expect(stream.nextPacket).toHaveBeenCalledTimes(2)
})

test('Symbol.iterator hits fallback object inside while loop', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce({ n: 1, s: 0, e: 0 })
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  const iter = stream[Symbol.iterator]()
  expect(iter.next()).toEqual({ value: undefined, done: true })
  expect(stream.nextPacket).toHaveBeenCalledTimes(3)
})

test('nalus() hits fallback object before while loop', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  const iter = stream.nalus()[Symbol.iterator]()
  expect(iter.next()).toEqual({ value: undefined, done: true })
  expect(stream.nextPacket).toHaveBeenCalledTimes(2)
})

test('nalus() hits fallback object inside while loop', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce({ n: 1, s: 0, e: 0 })
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  const iter = stream.nalus()[Symbol.iterator]()
  expect(iter.next()).toEqual({ value: undefined, done: true })
  expect(stream.nextPacket).toHaveBeenCalledTimes(3)
})

test('iterate hits fallback object inside while loop', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce({ n: 1, s: 0, e: 0 })
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  expect(stream.iterate()).toBe(0)
  expect(stream.nextPacket).toHaveBeenCalledTimes(3)
})

export {}
