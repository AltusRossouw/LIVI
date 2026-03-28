import { Bitstream, NALUStream, RawBitstream, SPS } from '../h264-utils'

describe('RawBitstream', () => {
  test('reads and writes primitive bit values', () => {
    const bs = new RawBitstream(32)

    bs.put_u_1(1)
    bs.put_u(0b01, 2)
    bs.put_u8(0xaa)
    bs.put_u(0b1111, 4)

    bs.seek(0)
    expect(bs.u_1()).toBe(1)
    expect(bs.u_2()).toBe(0b01)
    expect(bs.u_8()).toBe(0xaa)
    expect(bs.u(4)).toBe(0b1111)
  })

  test('encodes and decodes Exp-Golomb values', () => {
    const bs = new RawBitstream(128)
    const ueValues = [0, 1, 5, 31]
    const seValues = [0, -1, 1, -3, 7]

    ueValues.forEach((v) => bs.put_ue_v(v))
    seValues.forEach((v) => bs.put_se_v(v))
    bs.put_complete()

    ueValues.forEach((v) => expect(bs.ue_v()).toBe(v))
    seValues.forEach((v) => expect(bs.se_v()).toBe(v))
  })

  test('supports copyBits on aligned and unaligned pointers', () => {
    const src = new RawBitstream(64)
    src.put_u8(0b11110000)
    src.put_u8(0b00001111)

    const dstAligned = new RawBitstream(64)
    dstAligned.copyBits(src, 0, 16, 0)
    dstAligned.seek(0)
    expect(dstAligned.u_8()).toBe(0b11110000)
    expect(dstAligned.u_8()).toBe(0b00001111)

    const dstUnaligned = new RawBitstream(64)
    dstUnaligned.put_u_1(1)
    dstUnaligned.copyBits(src, 3, 10, undefined)
    dstUnaligned.seek(1)
    expect(dstUnaligned.u(10)).toBe(0b1000000001)
  })

  test('supports seek/peek and throws on overflow', () => {
    const bs = new RawBitstream(8)
    bs.put_u8(0b10101010)
    bs.seek(0)

    expect(bs.peek16).toContain('1010')
    expect(bs.remaining).toBe(8)
    expect(bs.consumed).toBe(0)

    bs.seek(8)
    expect(() => bs.u_1()).toThrow('NALUStream error: bitstream exhausted')
    expect(() => bs.seek(9)).toThrow('cannot seek beyond end')
  })

  test('reads unaligned u_8 branch', () => {
    const bs = new RawBitstream(24)
    bs.put_u(0b111, 3)
    bs.put_u8(0b10101010)
    bs.put_u(0b11, 2)
    bs.seek(3)

    expect(bs.u_8()).toBe(0b10101010)
  })
})

test('RawBitstream default seek and overflow branches', () => {
  const bs = new RawBitstream(8)

  bs.seek()
  expect(bs.consumed).toBe(0)

  expect(() => new RawBitstream(0).put_u_1(1)).toThrow('NALUStream error: bitstream exhausted')
  expect(() => bs.u(9)).toThrow('NALUStream error: bitstream exhausted')

  const empty = new RawBitstream(0)
  expect(() => empty.u_8()).toThrow('NALUStream error: bitstream exhausted')
})

test('RawBitstream u(n === 8) branch', () => {
  const bs = new RawBitstream(8)
  bs.put_u8(0xab)
  bs.seek(0)

  expect(bs.u(8)).toBe(0xab)
})

describe('Bitstream', () => {
  test('detects and removes emulation prevention bytes', () => {
    const src = new Uint8Array([0x67, 0x00, 0x00, 0x03, 0x01, 0xaa])
    const bs = new Bitstream(src)

    expect(bs.deemulated).toBe(true)
    expect(Array.from(bs.buffer)).toEqual([0x67, 0x00, 0x00, 0x01, 0xaa])

    const restored = Array.from(bs.stream)
    expect(restored.slice(0, src.length)).toEqual(Array.from(src))
  })

  test('keeps clean streams untouched', () => {
    const src = new Uint8Array([0x67, 0x11, 0x22, 0x33])
    const bs = new Bitstream(src)

    expect(bs.deemulated).toBe(false)
    expect(Array.from(bs.stream)).toEqual(Array.from(src))
  })

  test('copyBits inherits deemulated flag', () => {
    const from = new Bitstream(new Uint8Array([0x00, 0x00, 0x03, 0x01]))
    const to = new Bitstream(32)

    to.copyBits(from, 0, 8, 0)
    expect(to.deemulated).toBe(from.deemulated)
  })
})

describe('NALUStream', () => {
  const annexB = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x01, 0x68, 0xee, 0x3c, 0x80
  ])

  test('detects annexB and iterates packets', () => {
    const stream = new NALUStream(annexB, {} as never)

    expect(stream.type).toBe('annexB')
    expect(stream.boxSize).toBe(4)
    expect(stream.packetCount).toBe(2)
    expect(stream.packets).toHaveLength(2)

    const iterated = Array.from(stream)
    expect(iterated).toHaveLength(2)
    expect(iterated[0]?.[0]).toBe(0x67)

    const naluPairs = Array.from(stream.nalus())
    expect(naluPairs).toHaveLength(2)
    expect(naluPairs[0]?.rawNalu.length).toBeGreaterThan(naluPairs[0]?.nalu.length ?? 0)
  })

  test('converts annexB to packet and back', () => {
    const copy = new Uint8Array(annexB)
    const stream = new NALUStream(copy, { type: 'annexB', boxSize: 4 })

    stream.convertToPacket()
    expect(stream.type).toBe('packet')

    stream.convertToAnnexB()
    expect(stream.type).toBe('annexB')
  })

  test('works with packet streams and helpers', () => {
    const packet = new Uint8Array([
      0x00, 0x00, 0x00, 0x03, 0x65, 0x88, 0x99, 0x00, 0x00, 0x00, 0x02, 0x61, 0x00
    ])

    const stream = new NALUStream(packet, { type: 'packet', boxSize: 4 })
    expect(stream.packetCount).toBe(2)
    expect(stream.boxSizeMinusOne).toBe(3)

    expect(NALUStream.readUIntNBE(packet, 0, 4)).toBe(3)
    expect(NALUStream.array2hex(new Uint8Array([0, 10, 255]))).toBe('00 0a ff')

    const bad = stream.nextLengthCountedPacket(new Uint8Array([0, 0, 0, 1]), 0, 4)
    expect(bad.n).toBe(-2)
    expect(bad.message).toBe('bad length')
  })

  test('handles strict validation and unknown streams', () => {
    expect(
      () => new NALUStream(new Uint8Array([1, 2, 3, 4]), { type: 'invalid' as never })
    ).toThrow('type must be packet or annexB')

    expect(
      () =>
        new NALUStream(new Uint8Array([1, 2, 3, 4]), { type: 'packet', strict: true, boxSize: 1 })
    ).toThrow('invalid boxSize')

    const unknown = new NALUStream(new Uint8Array([9, 9, 9, 9]), { type: 'unknown' })
    expect(unknown.iterate()).toBe(0)

    expect(() =>
      new NALUStream(new Uint8Array([9, 9, 9, 9]), { type: 'unknown', strict: true }).getType(2)
    ).toThrow('cannot determine stream type or box size')
  })

  test('readUIntNBE requires box size', () => {
    expect(() => NALUStream.readUIntNBE(new Uint8Array([1, 2]), 0, 0)).toThrow('need a boxsize')
  })
})

describe('SPS', () => {
  test('throws for invalid NALU header and type', () => {
    expect(() => new SPS(new Uint8Array([0x80]))).toThrow('invalid NALU header')

    const notSps = new Uint8Array([0x65, 0x42, 0x00, 0x1e, 0xf4])
    expect(() => new SPS(notSps)).toThrow('SPS error: not SPS')
  })

  test('throws for unsupported profile idc', () => {
    const badProfile = new Uint8Array([0x67, 0x01, 0x00, 0x1e, 0x80])
    expect(() => new SPS(badProfile)).toThrow('invalid profile_idc')
  })

  test('parses a valid baseline SPS and exposes MIME', () => {
    const spsNalu = new Uint8Array([0x67, 0x42, 0x00, 0x1f, 0xe9, 0x01, 0x40, 0x7b, 0x20])

    const sps = new SPS(spsNalu)
    expect(sps.success).toBe(true)
    expect(sps.profileName).toBe('BASELINE')
    expect(sps.MIME.startsWith('avc1.')).toBe(true)
    expect(sps.stream.length).toBeGreaterThan(0)
  })

  describe('additional coverage', () => {
    test('RawBitstream constructor without stream uses default buffer', () => {
      const bs = new RawBitstream(undefined as unknown as number)

      expect(bs.buffer.byteLength).toBe(8192)
      expect(bs.remaining).toBe(8192 << 3)
    })

    test('RawBitstream copyBits hits long unaligned branch', () => {
      const src = new RawBitstream(
        new Uint8Array([0xff, 0x00, 0xaa, 0x55, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0])
      )
      const dst = new RawBitstream(128)

      dst.seek(5)
      dst.copyBits(src, 3, 72, undefined)

      dst.seek(5)
      expect(dst.u(8)).toBeGreaterThanOrEqual(0)
    })

    test('NALUStream convertToPacket throws for oversized 3-byte packet length in strict mode', () => {
      const buf = new Uint8Array(3 + 0x01000000)
      buf[0] = 0x00
      buf[1] = 0x00
      buf[2] = 0x01
      buf[3] = 0x67

      const stream = new NALUStream(buf, { type: 'annexB', boxSize: 3, strict: true })

      expect(() => stream.convertToPacket()).toThrow(
        'Packet too long to store length when boxLenMinusOne is 2'
      )
    })

    test('NALUStream convertToAnnexB covers boxSize 3 branch', () => {
      const packet = new Uint8Array([0x00, 0x00, 0x02, 0x65, 0x88, 0x00, 0x00, 0x02, 0x61, 0x99])

      const stream = new NALUStream(packet, { type: 'packet', boxSize: 3, strict: true })
      stream.convertToAnnexB()

      expect(stream.type).toBe('annexB')
      expect(Array.from(stream.buf.slice(0, 3))).toEqual([0x00, 0x00, 0x01])
      expect(Array.from(stream.buf.slice(5, 8))).toEqual([0x00, 0x00, 0x01])
    })

    test('NALUStream nextAnnexBPacket covers end-of-buffer return', () => {
      const buf = new Uint8Array([0x00, 0x00, 0x01, 0x67, 0x64])
      const stream = new NALUStream(buf, { type: 'annexB', boxSize: 3, strict: true })

      expect(stream.nextAnnexBPacket(stream.buf, stream.buf.length, 3)).toEqual({
        n: -1,
        s: stream.buf.length,
        e: stream.buf.length
      })

      expect(stream.nextAnnexBPacket(stream.buf, 3, 3)).toEqual({
        n: -1,
        s: 3,
        e: 5
      })
    })
  })

  describe('SPS branch coverage', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    function mockSpsParsing({
      u1 = [],
      u2 = [],
      u = [],
      u8 = [],
      ue = [],
      se = []
    }: {
      u1?: number[]
      u2?: number[]
      u?: number[]
      u8?: number[]
      ue?: number[]
      se?: number[]
    }) {
      jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
        if (!u1.length) throw new Error('u_1 underflow')
        return u1.shift()!
      })
      jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
        if (!u2.length) throw new Error('u_2 underflow')
        return u2.shift()!
      })
      jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
        if (!u.length) throw new Error('u underflow')
        return u.shift()!
      })
      jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
        if (!u8.length) throw new Error('u_8 underflow')
        return u8.shift()!
      })
      jest.spyOn(Bitstream.prototype, 'ue_v').mockImplementation(() => {
        if (!ue.length) throw new Error('ue_v underflow')
        return ue.shift()!
      })
      jest.spyOn(Bitstream.prototype, 'se_v').mockImplementation(() => {
        if (!se.length) throw new Error('se_v underflow')
        return se.shift()!
      })
    }

    test('throws when seq_parameter_set_id is greater than 31', () => {
      mockSpsParsing({
        u1: [0, 0, 0, 0, 0, 0, 0],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [32]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: seq_parameter_set_id must be 31 or less'
      )
    })

    test('throws when bit_depth_luma_minus8 is greater than 6', () => {
      mockSpsParsing({
        u1: [0, 0, 0, 0, 0, 0, 0],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [0, 1, 7]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: bit_depth_luma_minus8 must be 6 or less'
      )
    })

    test('throws when bit_depth_chroma_minus8 is greater than 6', () => {
      mockSpsParsing({
        u1: [0, 0, 0, 0, 0, 0, 0],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [0, 1, 0, 7]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: bit_depth_chroma_minus8 must be 6 or less'
      )
    })

    test('throws when log2_max_frame_num_minus4 is greater than 12', () => {
      mockSpsParsing({
        u1: [
          0, // forbidden_zero_bit
          0,
          0,
          0,
          0,
          0,
          0, // constraint flags
          0, // lossless_qpprime_flag
          0 // seq_scaling_matrix_present_flag
        ],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [
          0, // seq_parameter_set_id
          1, // chroma_format_idc
          0, // bit_depth_luma_minus8
          0, // bit_depth_chroma_minus8
          13 // log2_max_frame_num_minus4
        ]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: log2_max_frame_num_minus4 must be 12 or less'
      )
    })

    test('throws when pic_order_cnt_type is greater than 2', () => {
      mockSpsParsing({
        u1: [
          0, // forbidden_zero_bit
          0,
          0,
          0,
          0,
          0,
          0, // constraint flags
          0, // lossless_qpprime_flag
          0 // seq_scaling_matrix_present_flag
        ],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [
          0, // seq_parameter_set_id
          1, // chroma_format_idc
          0, // bit_depth_luma_minus8
          0, // bit_depth_chroma_minus8
          0, // log2_max_frame_num_minus4
          3 // pic_order_cnt_type
        ]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: pic_order_cnt_type must be 2 or less'
      )
    })

    test('throws when log2_max_pic_order_cnt_lsb_minus4 is greater than 12', () => {
      mockSpsParsing({
        u1: [
          0, // forbidden_zero_bit
          0,
          0,
          0,
          0,
          0,
          0, // constraint flags
          0, // lossless_qpprime_flag
          0 // seq_scaling_matrix_present_flag
        ],
        u2: [3, 0],
        u: [7],
        u8: [100, 40],
        ue: [
          0, // seq_parameter_set_id
          1, // chroma_format_idc
          0, // bit_depth_luma_minus8
          0, // bit_depth_chroma_minus8
          0, // log2_max_frame_num_minus4
          0, // pic_order_cnt_type
          13 // log2_max_pic_order_cnt_lsb_minus4
        ]
      })

      expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
        'SPS error: log2_max_pic_order_cnt_lsb_minus4 must be 12 or less'
      )
    })

    test('parses high profile branches including scaling matrices, poc type 1, cropping and VUI', () => {
      mockSpsParsing({
        u1: [
          0, // forbidden_zero_bit
          0,
          0,
          0,
          0,
          0,
          0, // constraint flags
          1, // separate_colour_plane_flag
          0, // lossless_qpprime_flag
          1, // seq_scaling_matrix_present_flag

          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0, // seqScalingListPresentFlag x12

          1, // delta_pic_order_always_zero_flag
          0, // gaps_in_frame_num_value_allowed_flag
          0, // frame_mbs_only_flag
          1, // mb_adaptive_frame_field_flag
          1, // direct_8x8_inference_flag
          1, // frame_cropping_flag

          1, // vui_parameters_present_flag
          1, // aspect_ratio_info_present_flag
          1, // overscan_info_present_flag
          1, // overscan_appropriate_flag
          1, // video_signal_type_present_flag
          1, // video_full_range_flag
          1, // color_description_present_flag
          1, // chroma_loc_info_present_flag
          1, // timing_info_present_flag
          1, // fixed_frame_rate_flag
          0 // nal_hrd_parameters_present_flag
        ],
        u2: [3, 0],
        u: [
          7, // nal_unit_type
          1, // sar_width
          1, // sar_height
          3, // video_format
          1000, // num_units_in_tick
          60000 // time_scale
        ],
        u8: [
          100, // profile_idc
          40, // level_idc
          255, // aspect_ratio_idc
          1, // color_primaries
          1, // transfer_characteristics
          1 // matrix_coefficients
        ],
        ue: [
          0, // seq_parameter_set_id
          3, // chroma_format_idc
          0, // bit_depth_luma_minus8
          0, // bit_depth_chroma_minus8

          0, // log2_max_frame_num_minus4
          1, // pic_order_cnt_type
          2, // num_ref_frames_in_pic_order_cnt_cycle

          1, // max_num_ref_frames
          19, // pic_width_in_mbs_minus_1
          14, // pic_height_in_map_units_minus_1

          1, // crop left
          2, // crop right
          3, // crop top
          4, // crop bottom

          5, // chroma_sample_loc_type_top_field
          6 // chroma_sample_loc_type_bottom_field
        ],
        se: [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16, // scaling list
          -1, // offset_for_non_ref_pic
          2, // offset_for_top_to_bottom_field
          3,
          4 // offset_for_ref_frame x2
        ]
      })

      const sps = new SPS(new Uint8Array([0x67]))

      expect(sps.success).toBe(true)
      expect(sps.chroma_format_idc).toBe(3)
      expect(sps.separate_colour_plane_flag).toBe(1)
      expect(sps.seq_scaling_list_present_flag).toHaveLength(12)
      expect(sps.pic_order_cnt_type).toBe(1)
      expect(sps.offset_for_ref_frame).toEqual([3, 4])
      expect(sps.mb_adaptive_frame_field_flag).toBe(1)
      expect(sps.frame_cropping_rect_left_offset).toBe(1)
      expect(sps.frame_cropping_rect_bottom_offset).toBe(4)
      expect(sps.aspect_ratio_idc).toBe(255)
      expect(sps.sar_width).toBe(1)
      expect(sps.sar_height).toBe(1)
      expect(sps.video_format).toBe(3)
      expect(sps.color_primaries).toBe(1)
      expect(sps.chroma_sample_loc_type_top_field).toBe(5)
      expect(sps.framesPerSecond).toBe(30)
    })
  })
})
