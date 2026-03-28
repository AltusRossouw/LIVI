const h264tools = require('../h264-utils')
const { Bitstream, SPS } = h264tools
const avccConfigs: any[] = require('./sampledata')

test('SPS parser SPS', () => {
  for (let i = 0; i < avccConfigs.length; i++) {
    const cfg = avccConfigs[i]
    const sps = new h264tools.SPS(cfg.sps)
    expect(sps.success).toBeTruthy()
    expect(sps.MIME).toEqual(cfg.mime)
  }
})

test('SPS parser SPS from avcC', () => {
  for (let i = 0; i < avccConfigs.length; i++) {
    const cfg = avccConfigs[i]
    if (cfg.avcC) {
      const avc = new h264tools.AvcC({ avcC: cfg.avcC })
      expect(avc.sps.length).toBeGreaterThanOrEqual(1)
      for (let p = 0; p < avc.sps.length; p++) {
        const sps = new h264tools.SPS(avc.sps[p])
        expect(sps.success).toBeTruthy()
        expect(sps.MIME).toEqual(cfg.mime)
      }
    }
  }
})

test('SPS throws when chroma_format_idc is greater than 3', () => {
  const u1 = [0, 0, 0, 0, 0, 0, 0]
  const u2 = [3, 0]
  const u = [7]
  const u8 = [100, 40]
  const ue = [0, 4]

  const u1Spy = jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
    if (!u1.length) throw new Error('u_1 underflow')
    return u1.shift()
  })
  const u2Spy = jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
    if (!u2.length) throw new Error('u_2 underflow')
    return u2.shift()
  })
  const uSpy = jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
    if (!u.length) throw new Error('u underflow')
    return u.shift()
  })
  const u8Spy = jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
    if (!u8.length) throw new Error('u_8 underflow')
    return u8.shift()
  })
  const ueSpy = jest.spyOn(Bitstream.prototype, 'ue_v').mockImplementation(() => {
    if (!ue.length) throw new Error('ue_v underflow')
    return ue.shift()
  })

  expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
    'SPS error: chroma_format_idc must be 3 or less'
  )

  u1Spy.mockRestore()
  u2Spy.mockRestore()
  uSpy.mockRestore()
  u8Spy.mockRestore()
  ueSpy.mockRestore()
})

test('SPS throws when reserved_zero_2bits is not zero', () => {
  const u1 = [0, 0, 0, 0, 0, 0, 0]
  const u2 = [3, 1]
  const u = [7]
  const u8 = [100]

  const u1Spy = jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
    if (!u1.length) throw new Error('u_1 underflow')
    return u1.shift()
  })
  const u2Spy = jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
    if (!u2.length) throw new Error('u_2 underflow')
    return u2.shift()
  })
  const uSpy = jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
    if (!u.length) throw new Error('u underflow')
    return u.shift()
  })
  const u8Spy = jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
    if (!u8.length) throw new Error('u_8 underflow')
    return u8.shift()
  })

  expect(() => new SPS(new Uint8Array([0x67]))).toThrow(
    'SPS error: reserved_zero_2bits must be zero'
  )

  u1Spy.mockRestore()
  u2Spy.mockRestore()
  uSpy.mockRestore()
  u8Spy.mockRestore()
})

test('SPS sets chromaArrayType to chroma_format_idc when separate_colour_plane_flag is 0', () => {
  const u1 = [
    0, // forbidden_zero_bit
    0,
    0,
    0,
    0,
    0,
    0, // constraint flags
    0, // separate_colour_plane_flag
    0, // lossless_qpprime_flag
    0, // seq_scaling_matrix_present_flag
    0, // gaps_in_frame_num_value_allowed_flag
    1, // frame_mbs_only_flag
    1, // direct_8x8_inference_flag
    0, // frame_cropping_flag
    0 // vui_parameters_present_flag
  ]
  const u2 = [3, 0]
  const u = [7]
  const u8 = [100, 40]
  const ue = [
    0, // seq_parameter_set_id
    3, // chroma_format_idc
    0, // bit_depth_luma_minus8
    0, // bit_depth_chroma_minus8
    0, // log2_max_frame_num_minus4
    0, // pic_order_cnt_type
    0, // log2_max_pic_order_cnt_lsb_minus4
    1, // max_num_ref_frames
    19, // pic_width_in_mbs_minus_1
    14 // pic_height_in_map_units_minus_1
  ]

  const u1Spy = jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
    if (!u1.length) throw new Error('u_1 underflow')
    return u1.shift()
  })
  const u2Spy = jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
    if (!u2.length) throw new Error('u_2 underflow')
    return u2.shift()
  })
  const uSpy = jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
    if (!u.length) throw new Error('u underflow')
    return u.shift()
  })
  const u8Spy = jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
    if (!u8.length) throw new Error('u_8 underflow')
    return u8.shift()
  })
  const ueSpy = jest.spyOn(Bitstream.prototype, 'ue_v').mockImplementation(() => {
    if (!ue.length) throw new Error('ue_v underflow')
    return ue.shift()
  })

  const sps = new SPS(new Uint8Array([0x67]))

  expect(sps.chroma_format_idc).toBe(3)
  expect(sps.separate_colour_plane_flag).toBe(0)
  expect(sps.chromaArrayType).toBe(3)

  u1Spy.mockRestore()
  u2Spy.mockRestore()
  uSpy.mockRestore()
  u8Spy.mockRestore()
  ueSpy.mockRestore()
})

test('SPS parses scaling list when seq_scaling_matrix_present_flag is 1', () => {
  const u1 = [
    0, // forbidden_zero_bit
    0,
    0,
    0,
    0,
    0,
    0, // constraint flags
    0, // separate_colour_plane_flag
    0, // lossless_qpprime_flag
    1, // seq_scaling_matrix_present_flag

    1, // seqScalingListPresentFlag[0]
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
    0, // remaining seqScalingListPresentFlag entries

    0, // gaps_in_frame_num_value_allowed_flag
    1, // frame_mbs_only_flag
    1, // direct_8x8_inference_flag
    0, // frame_cropping_flag
    0 // vui_parameters_present_flag
  ]

  const u2 = [3, 0]
  const u = [7]
  const u8 = [100, 40]
  const ue = [
    0, // seq_parameter_set_id
    3, // chroma_format_idc
    0, // bit_depth_luma_minus8
    0, // bit_depth_chroma_minus8
    0, // log2_max_frame_num_minus4
    0, // pic_order_cnt_type
    0, // log2_max_pic_order_cnt_lsb_minus4
    1, // max_num_ref_frames
    19, // pic_width_in_mbs_minus_1
    14 // pic_height_in_map_units_minus_1
  ]
  const se = new Array(16).fill(1)

  const u1Spy = jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
    if (!u1.length) throw new Error('u_1 underflow')
    return u1.shift()
  })
  const u2Spy = jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
    if (!u2.length) throw new Error('u_2 underflow')
    return u2.shift()
  })
  const uSpy = jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
    if (!u.length) throw new Error('u underflow')
    return u.shift()
  })
  const u8Spy = jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
    if (!u8.length) throw new Error('u_8 underflow')
    return u8.shift()
  })
  const ueSpy = jest.spyOn(Bitstream.prototype, 'ue_v').mockImplementation(() => {
    if (!ue.length) throw new Error('ue_v underflow')
    return ue.shift()
  })
  const seSpy = jest.spyOn(Bitstream.prototype, 'se_v').mockImplementation(() => {
    if (!se.length) throw new Error('se_v underflow')
    return se.shift()
  })

  const sps = new SPS(new Uint8Array([0x67]))

  expect(sps.seq_scaling_matrix_present_flag).toBe(1)
  expect(sps.seq_scaling_list_present_flag).toHaveLength(12)
  expect(sps.seq_scaling_list_present_flag[0]).toBe(1)
  expect(sps.seq_scaling_list.length).toBe(16)
  expect(sps.seq_scaling_list[0].length).toBe(16)
  expect(seSpy).toHaveBeenCalledTimes(16)

  u1Spy.mockRestore()
  u2Spy.mockRestore()
  uSpy.mockRestore()
  u8Spy.mockRestore()
  ueSpy.mockRestore()
  seSpy.mockRestore()
})

test('SPS parses sar_width and sar_height when aspect_ratio_idc is set', () => {
  const u1 = [
    0, // forbidden_zero_bit
    0,
    0,
    0,
    0,
    0,
    0, // constraint flags
    0, // gaps_in_frame_num_value_allowed_flag
    1, // frame_mbs_only_flag
    1, // direct_8x8_inference_flag
    0, // frame_cropping_flag
    1, // vui_parameters_present_flag
    1, // aspect_ratio_info_present_flag
    0, // overscan_info_present_flag
    0, // video_signal_type_present_flag
    0, // chroma_loc_info_present_flag
    0, // timing_info_present_flag
    0 // nal_hrd_parameters_present_flag
  ]

  const u2 = [3, 0]
  const u = [7, 123, 456]
  const u8 = [66, 40, 255]
  const ue = [
    0, // seq_parameter_set_id
    0, // log2_max_frame_num_minus4
    0, // pic_order_cnt_type
    0, // log2_max_pic_order_cnt_lsb_minus4
    1, // max_num_ref_frames
    19, // pic_width_in_mbs_minus_1
    14 // pic_height_in_map_units_minus_1
  ]

  const u1Spy = jest.spyOn(Bitstream.prototype, 'u_1').mockImplementation(() => {
    if (!u1.length) throw new Error('u_1 underflow')
    return u1.shift()
  })
  const u2Spy = jest.spyOn(Bitstream.prototype, 'u_2').mockImplementation(() => {
    if (!u2.length) throw new Error('u_2 underflow')
    return u2.shift()
  })
  const uSpy = jest.spyOn(Bitstream.prototype, 'u').mockImplementation(() => {
    if (!u.length) throw new Error('u underflow')
    return u.shift()
  })
  const u8Spy = jest.spyOn(Bitstream.prototype, 'u_8').mockImplementation(() => {
    if (!u8.length) throw new Error('u_8 underflow')
    return u8.shift()
  })
  const ueSpy = jest.spyOn(Bitstream.prototype, 'ue_v').mockImplementation(() => {
    if (!ue.length) throw new Error('ue_v underflow')
    return ue.shift()
  })

  const sps = new SPS(new Uint8Array([0x67]))

  expect(sps.aspect_ratio_idc).toBe(255)
  expect(sps.sar_width).toBe(123)
  expect(sps.sar_height).toBe(456)

  u1Spy.mockRestore()
  u2Spy.mockRestore()
  uSpy.mockRestore()
  u8Spy.mockRestore()
  ueSpy.mockRestore()
})

export {}
