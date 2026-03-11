export enum HandDriveType {
  LHD = 0,
  RHD = 1
}

export enum MicType {
  CarMic = 0,
  DongleMic = 1,
  PhoneMic = 2
}

export enum PhoneWorkMode {
  CarPlay = 2,
  Android = 4
}

export type PhoneTypeConfig = { frameInterval: number | null }

export type DongleConfig = {
  width: number
  height: number
  fps: number
  dpi: number
  lastPhoneWorkMode: number
  apkVer: string
  nightMode: boolean
  carName: string
  oemName: string
  hand: HandDriveType
  mediaDelay: number
  mediaSound: 0 | 1
  callQuality: 0 | 1 | 2
  // Currently disabled:
  // riddleBoxCfg uses `riddleBoxCfg -s AutoPlauMusic 1`, but setting it does not work.
  // Likely vendor typo or firmware-side bug.
  // autoPlay: boolean
  autoConn: boolean
  mapsEnabled: boolean
  audioTransferMode: boolean
  wifiType: '2.4ghz' | '5ghz'
  wifiChannel: number
  micType: MicType
  phoneConfig: Partial<Record<number, PhoneTypeConfig>>
}
