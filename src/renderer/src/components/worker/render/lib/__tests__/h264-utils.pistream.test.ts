const { Bitstream, NALUStream } = require('../h264-utils')

const fs = require('fs')
const path = require('path')

const filename1 = path.join(__dirname, '/__data__/video-cif-250.h264')

test('emulation', () => {
  const buf = fs.readFileSync(filename1, null)
  const s = new NALUStream(buf)

  for (const naluBitstream of s) {
    const bitstream = new Bitstream(naluBitstream)
    expect(bitstream.stream).toEqual(naluBitstream)
  }
})

test('emulation qcif', () => {
  const buf = fs.readFileSync(filename1, null)
  const s = new NALUStream(buf)

  for (const naluBitstream of s) {
    const bitstream = new Bitstream(naluBitstream)
    expect(bitstream.stream).toEqual(naluBitstream)
  }
})

export {}
