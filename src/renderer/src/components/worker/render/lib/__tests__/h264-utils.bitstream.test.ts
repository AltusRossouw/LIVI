const h264tools = require('../h264-utils')
const { avccConfigs } = require('./sampledata')

test('Bitstream parser PPS NALUs', () => {
  for (let i = 0; i < avccConfigs.length; i++) {
    const cfg = avccConfigs[i]
    const bitstream = new h264tools.Bitstream(cfg.pps)

    const forbidden_zero_bit = bitstream.u_1()
    expect(forbidden_zero_bit).toEqual(0)
    bitstream.u_2()
    bitstream.u(5)
    expect(bitstream.consumed & 0x07).toEqual(0)

    bitstream.ue_v()
    bitstream.ue_v()
    bitstream.u_1()
    bitstream.u_1()
    const num_slice_groups_minus1 = bitstream.ue_v()

    if (num_slice_groups_minus1 > 0) {
      const slice_group_map_type = bitstream.ue_v()
      switch (slice_group_map_type) {
        case 0:
          for (let j = 0; j <= num_slice_groups_minus1; j++) {
            bitstream.ue_v()
          }
          break

        case 1:
          break

        case 2:
          for (let j = 0; j <= num_slice_groups_minus1; j++) {
            const top_left = bitstream.ue_v()
            const bottom_right = bitstream.ue_v()
            expect(top_left).toBeLessThanOrEqual(bottom_right)
          }
          break

        case 3:
        case 4:
        case 5:
          expect(num_slice_groups_minus1).toEqual(1)
          bitstream.u_1()
          bitstream.ue_v()
          break

        case 6: {
          let numberBitsPerSliceGroupId
          if (num_slice_groups_minus1 + 1 > 4) {
            numberBitsPerSliceGroupId = 3
          } else if (num_slice_groups_minus1 + 1 > 2) {
            numberBitsPerSliceGroupId = 2
          } else {
            numberBitsPerSliceGroupId = 1
          }

          const pic_size_in_map_units_minus1 = bitstream.ue_v()
          for (let j = 0; j <= pic_size_in_map_units_minus1; j++) {
            const slice_group_id = bitstream.u(numberBitsPerSliceGroupId)
            expect(slice_group_id).toBeLessThanOrEqual(num_slice_groups_minus1)
          }
          break
        }

        default:
          throw new Error(`unsupported slice_group_map_type: ${slice_group_map_type}`)
      }
    }

    const num_ref_idx_l0_active_minus1 = bitstream.ue_v()
    expect(num_ref_idx_l0_active_minus1).toBeLessThanOrEqual(31)

    const num_ref_idx_l1_active_minus1 = bitstream.ue_v()
    expect(num_ref_idx_l1_active_minus1).toBeLessThanOrEqual(31)

    bitstream.u_1()
    bitstream.u_2()

    const pic_init_qp_minus26 = bitstream.se_v()
    expect(pic_init_qp_minus26).toBeLessThanOrEqual(25)

    const pic_init_qs_minus26 = bitstream.se_v()
    expect(pic_init_qs_minus26).toBeLessThanOrEqual(25)

    bitstream.u_1()
    bitstream.u_1()
    bitstream.u_1()
  }
})

test('Bitstream parser SPS NALUs', () => {
  for (let i = 0; i < avccConfigs.length; i++) {
    const cfg = avccConfigs[i]
    const bitstream = new h264tools.Bitstream(cfg.sps)

    expect(bitstream.peek16).toBeDefined()

    const forbidden_zero_bit = bitstream.u_1()
    expect(forbidden_zero_bit).toEqual(0)
    bitstream.u_2()
    bitstream.u(5)
    expect(bitstream.consumed & 0x07).toEqual(0)

    const profile_idc = bitstream.u_8()
    expect(bitstream.consumed & 0x07).toEqual(0)

    bitstream.u_1()
    bitstream.u_1()
    bitstream.u_1()
    bitstream.u_1()
    bitstream.u_1()
    bitstream.u_1()

    const reserved_zero_2bits = bitstream.u_2()
    expect(reserved_zero_2bits).toEqual(0)
    expect(bitstream.consumed & 0x07).toEqual(0)

    bitstream.u_8()
    expect(bitstream.consumed & 0x07).toEqual(0)

    const seq_parameter_set_id = bitstream.ue_v()
    expect(seq_parameter_set_id).toBeGreaterThanOrEqual(0)
    expect(seq_parameter_set_id).toBeLessThanOrEqual(31)

    const has_no_chroma_format_idc = profile_idc === 66 || profile_idc === 77 || profile_idc === 88

    if (!has_no_chroma_format_idc) {
      const chroma_format_idc = bitstream.ue_v()
      expect(chroma_format_idc).toBeGreaterThanOrEqual(0)
      expect(chroma_format_idc).toBeLessThanOrEqual(3)

      if (chroma_format_idc === 3) {
        bitstream.u_1()
      }

      const bit_depth_luma_minus8 = bitstream.ue_v()
      expect(bit_depth_luma_minus8).toBeGreaterThanOrEqual(0)
      expect(bit_depth_luma_minus8).toBeLessThanOrEqual(6)

      const bit_depth_chroma_minus8 = bitstream.ue_v()
      expect(bit_depth_chroma_minus8).toBeGreaterThanOrEqual(0)
      expect(bit_depth_chroma_minus8).toBeLessThanOrEqual(6)

      bitstream.u_1()
      const seq_scaling_matrix_present_flag = bitstream.u_1()

      if (seq_scaling_matrix_present_flag) {
        const nScalingList = chroma_format_idc !== 3 ? 8 : 12
        for (let j = 0; j < nScalingList; j++) {
          const seq_scaling_list_present_flag = bitstream.u_1()
          if (seq_scaling_list_present_flag) {
            const sizeOfScalingList = j < 6 ? 16 : 64
            let nextScale = 8
            let lastScale = 8

            for (let k = 0; k < sizeOfScalingList; k++) {
              if (nextScale !== 0) {
                const delta_scale = bitstream.se_v()
                nextScale = (lastScale + delta_scale + 256) % 256
              }
              lastScale = nextScale === 0 ? lastScale : nextScale
            }
          }
        }
      }
    }

    const log2_max_frame_num_minus4 = bitstream.ue_v()
    expect(log2_max_frame_num_minus4).toBeGreaterThanOrEqual(0)
    expect(log2_max_frame_num_minus4).toBeLessThanOrEqual(12)

    const pic_order_cnt_type = bitstream.ue_v()
    expect(pic_order_cnt_type).toBeGreaterThanOrEqual(0)
    expect(pic_order_cnt_type).toBeLessThanOrEqual(2)

    switch (pic_order_cnt_type) {
      case 0: {
        const log2_max_pic_order_cnt_lsb_minus4 = bitstream.ue_v()
        expect(log2_max_pic_order_cnt_lsb_minus4).toBeGreaterThanOrEqual(0)
        expect(log2_max_pic_order_cnt_lsb_minus4).toBeLessThanOrEqual(12)
        break
      }

      case 1: {
        bitstream.u_1()
        bitstream.se_v()
        bitstream.se_v()
        const num_ref_frames_in_pic_order_cnt_cycle = bitstream.ue_v()
        for (let j = 0; j < num_ref_frames_in_pic_order_cnt_cycle; j++) {
          bitstream.se_v()
        }
        break
      }

      case 2:
        break

      default:
        throw new Error('incorrect value of pic_order_cnt_type')
    }

    bitstream.ue_v()
    bitstream.u_1()
    bitstream.ue_v()
    const pic_height_in_map_units_minus_1 = bitstream.ue_v()
    const frame_mbs_only_flag = bitstream.u_1()

    if (frame_mbs_only_flag === 0) {
      bitstream.u_1()
      void pic_height_in_map_units_minus_1
    }

    bitstream.u_1()
    const frame_cropping_flag = bitstream.u_1()

    if (frame_cropping_flag) {
      bitstream.ue_v()
      bitstream.ue_v()
      bitstream.ue_v()
      bitstream.ue_v()
    }

    bitstream.u_1()
  }
})

export {}
