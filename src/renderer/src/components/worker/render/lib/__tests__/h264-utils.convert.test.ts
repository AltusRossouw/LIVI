const { NALUStream } = require('../h264-utils')
const h264tools = require('../h264-utils')

function makeArray(str) {
  if (typeof str !== 'string') str = str.join(' ')
  return new Uint8Array(str.match(/[\da-f]{2} */gi).map((s) => parseInt(s, 16)))
}

//const mime = 'avc1.42C01E'
//const avcCSample = makeArray(
//  '01 42 c0 1e ff e1 00 17 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8 01 00 04 68 ce 38 80'
//)

test('convert from annexB to packet, boxSize 4', () => {
  const bitstream = makeArray(
    '00 00 00 01 09 10 00 00 00 01 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8 00 00 00 01 68 ce 38 80 00 00 00 01 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 00 00 00 01 06 05 e8 cb b2 13 92 98 73 43 da a8 a6 c7 42 98 35 6c f5 73 72 63 3a 33 20 68 3a 34 38 30 20 77 3a 36 34 30 20 66 70 73 3a 33 30 2e 30 30 30 20 70 66 3a 36 36 20 6c 76 6c 3a 38 20 62 3a 30 20 62 71 70 3a 33 20 67 6f 70 3a 36 30 20 69 64 72 3a 36 30 20 73 6c 63 3a 35 20 63 6d 70 3a 30 20 72 63 3a 31 20 71 70 3a 32 36 20 72 61 74 65 3a 32 35 30 30 30 30 20 70 65 61 6b 3a 30 20 62 75 66 66 3a 39 33 37 35 30 20 72 65 66 3a 31 20 73 72 63 68 3a 33 32 20 61 73 72 63 68 3a 31 20 73 75 62 70 3a 31 20 70 61 72 3a 36 20 33 20 33 20 72 6e 64 3a 30 20 63 61 62 61 63 3a 30 20 6c 70 3a 30 20 63 74 6e 74 3a 30 20 61 75 64 3a 31 20 6c 61 74 3a 31 20 77 72 6b 3a 31 20 76 75 69 3a 31 20 6c 79 72 3a 31 20 3c 3c 00 80'
  )

  const streama = new h264tools.NALUStream(new Uint8Array(bitstream))
  const streamb = new h264tools.NALUStream(new Uint8Array(bitstream))

  expect(streama.buf).toEqual(streamb.buf)
  const bufb = streamb.convertToPacket().buf
  expect(streamb.type).toEqual('packet')

  expect(streama.packetCount).toEqual(streamb.packetCount)

  const aPackets = streama.packets
  const bPackets = streamb.packets
  expect(aPackets).toEqual(bPackets)

  const streamc = new h264tools.NALUStream(new Uint8Array(bufb))
  expect(streamb.buf).toEqual(streamc.buf)
})

test('convert from annexB to packet, boxSize 3', () => {
  const axb3 = makeArray(
    '00 00 01 09 10 00 00 01 67 42 c0 1e 95 a0 28 0f 68 40 00 00 03 00 40 00 00 0f 03 68 22 11 a8 00 00 01 68 ce 38 80 00 00 01 06 05 2f 02 f8 61 50 fc 70 41 72 b7 32 48 f3 a7 2a 3d 34 4d 69 63 72 6f 73 6f 66 74 20 48 2e 32 36 34 20 45 6e 63 6f 64 65 72 20 56 31 2e 35 2e 33 00 80 00 00 01 06 05 e8 cb b2 13 92 98 73 43 da a8 a6 c7 42 98 35 6c f5 73 72 63 3a 33 20 68 3a 34 38 30 20 77 3a 36 34 30 20 66 70 73 3a 33 30 2e 30 30 30 20 70 66 3a 36 36 20 6c 76 6c 3a 38 20 62 3a 30 20 62 71 70 3a 33 20 67 6f 70 3a 36 30 20 69 64 72 3a 36 30 20 73 6c 63 3a 35 20 63 6d 70 3a 30 20 72 63 3a 31 20 71 70 3a 32 36 20 72 61 74 65 3a 32 35 30 30 30 30 20 70 65 61 6b 3a 30 20 62 75 66 66 3a 39 33 37 35 30 20 72 65 66 3a 31 20 73 72 63 68 3a 33 32 20 61 73 72 63 68 3a 31 20 73 75 62 70 3a 31 20 70 61 72 3a 36 20 33 20 33 20 72 6e 64 3a 30 20 63 61 62 61 63 3a 30 20 6c 70 3a 30 20 63 74 6e 74 3a 0'
  )

  const streama = new h264tools.NALUStream(new Uint8Array(axb3))
  const streamb = new h264tools.NALUStream(new Uint8Array(axb3))

  expect(streama.buf).toEqual(streamb.buf)
  const bufb = streamb.convertToPacket().buf
  expect(streamb.type).toEqual('packet')

  expect(streama.packetCount).toEqual(streamb.packetCount)

  const aPackets = streama.packets
  const bPackets = streamb.packets
  expect(aPackets).toEqual(bPackets)

  const streamc = new h264tools.NALUStream(new Uint8Array(bufb))
  expect(streamb.buf).toEqual(streamc.buf)
})

test('NALUStream convert helpers early-return and error branches', () => {
  const annexB = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f])
  const packet4 = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x67, 0x42, 0x00, 0x1f])
  const packet3 = new Uint8Array([0x00, 0x00, 0x04, 0x67, 0x42, 0x00, 0x1f])

  const s1 = new NALUStream(packet4, { type: 'packet', boxSize: 4 })
  expect(s1.convertToPacket()).toBe(s1)

  const s2 = new NALUStream(annexB, { type: 'annexB', boxSize: 4 })
  expect(s2.convertToAnnexB()).toBe(s2)

  const s3 = new NALUStream(packet3, { type: 'packet', boxSize: 3 })
  s3.convertToAnnexB()
  expect(Array.from(s3.buf.slice(0, 3))).toEqual([0x00, 0x00, 0x01])
})

test('NALUStream convert branches throw on negative delimiter offsets', () => {
  const annex = Object.create(NALUStream.prototype)
  annex.type = 'annexB'
  annex.boxSize = 4
  annex.buf = new Uint8Array([0x67, 0x42, 0x00, 0x1f])
  annex.strict = false
  annex.cursor = 0
  annex.nextPacket = annex.nextAnnexBPacket
  annex.iterate = (cb) => {
    if (cb) cb(annex.buf, 1, 4)
    return 1
  }

  expect(() => annex.convertToPacket()).toThrow('NALUStream error: Unexpected packet format')

  const packet = Object.create(NALUStream.prototype)
  packet.type = 'packet'
  packet.boxSize = 3
  packet.buf = new Uint8Array([0x67, 0x42, 0x00, 0x1f])
  packet.strict = false
  packet.cursor = 0
  packet.nextPacket = packet.nextLengthCountedPacket
  packet.iterate = (cb) => {
    if (cb) cb(packet.buf, 1, 4)
    return 1
  }

  expect(() => packet.convertToAnnexB()).toThrow('Unexpected packet format')
})

test('convertToPacket covers annexB boxSize 3 write branch', () => {
  const stream = new NALUStream(new Uint8Array([0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f]), {
    type: 'annexB',
    boxSize: 3
  })

  stream.convertToPacket()

  expect(stream.type).toBe('packet')
  expect(Array.from(stream.buf.slice(0, 3))).toEqual([0x00, 0x00, 0x04])
})

test('convertToPacket boxSize 3 throws on negative delimiter offset', () => {
  const stream = Object.create(NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 3
  stream.buf = new Uint8Array([0x67, 0x42, 0x00, 0x1f])
  stream.strict = false
  stream.cursor = 0
  stream.nextPacket = stream.nextAnnexBPacket
  stream.iterate = function (cb) {
    cb(this.buf, 1, 4)
    return 1
  }

  expect(() => stream.convertToPacket()).toThrow('Unexpected packet format')
})

test('convertToAnnexB covers packet boxSize 4 write branch', () => {
  const stream = new NALUStream(new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x67, 0x42, 0x00, 0x1f]), {
    type: 'packet',
    boxSize: 4
  })

  stream.convertToAnnexB()

  expect(stream.type).toBe('annexB')
  expect(Array.from(stream.buf.slice(0, 4))).toEqual([0x00, 0x00, 0x00, 0x01])
})

test('convertToAnnexB uses packet boxSize 4 branch', () => {
  const packet = new Uint8Array([
    0x00, 0x00, 0x00, 0x02, 0x65, 0x88, 0x00, 0x00, 0x00, 0x02, 0x61, 0x99
  ])

  const stream = new h264tools.NALUStream(packet, { type: 'packet', boxSize: 4 })
  stream.convertToAnnexB()

  expect(stream.type).toBe('annexB')
  expect(Array.from(stream.buf.slice(0, 4))).toEqual([0x00, 0x00, 0x00, 0x01])
  expect(Array.from(stream.buf.slice(6, 10))).toEqual([0x00, 0x00, 0x00, 0x01])
})

test('convertToAnnexB throws for negative offset in packet boxSize 4 branch', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'packet'
  stream.boxSize = 4
  stream.strict = false
  stream.buf = new Uint8Array([0x65, 0x88, 0x99, 0xaa])
  stream.nextPacket = stream.nextLengthCountedPacket
  stream.iterate = (cb) => {
    cb(stream.buf, 1, 4)
    return 1
  }

  expect(() => stream.convertToAnnexB()).toThrow('NALUStream error: Unexpected packet format')
})

test('iterate hits fallback object on first nextPacket call', () => {
  const stream = Object.create(h264tools.NALUStream.prototype)
  stream.type = 'annexB'
  stream.boxSize = 4
  stream.buf = new Uint8Array([1, 2, 3, 4])

  stream.nextPacket = jest
    .fn()
    .mockReturnValueOnce(undefined)
    .mockReturnValueOnce({ n: -1, s: 0, e: 0 })

  expect(stream.iterate()).toBe(0)
  expect(stream.nextPacket).toHaveBeenCalledTimes(2)
})

export {}
