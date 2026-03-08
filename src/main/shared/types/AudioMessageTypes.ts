import type { AudioCommand } from './ProjectionEnums'

export type CoreAudioData = {
  command?: AudioCommand
  decodeType: number
  volume: number
  volumeDuration?: number
  audioType: number
  data?: Int16Array
}
