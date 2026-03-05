export type DevListEntry = {
  id?: string
  type?: string
  name?: string
  index?: string | number
  time?: string
  rfcomm?: string | number
}

export type BoxInfoPayload = {
  uuid?: string
  MFD?: string
  boxType?: string
  OemName?: string
  productType?: string
  HiCar?: number
  supportLinkType?: string
  supportFeatures?: string
  hwVersion?: string
  WiFiChannel?: number
  CusCode?: string
  DevList?: DevListEntry[]
  ChannelList?: string
  MDLinkType?: string
  MDModel?: string
  MDOSVersion?: string
  MDLinkVersion?: string
  btMacAddr?: string
  btName?: string
  cpuTemp?: number
}

export type DongleFwApiRaw = {
  err: number
  token?: string
  ver?: string
  size?: string | number
  id?: string
  notes?: string
  msg?: string
  error?: string
}

export type LocalFwStatus =
  | { ok: true; ready: true; path: string; bytes: number; model: string; latestVer?: string }
  | { ok: true; ready: false; reason: string }
  | { ok: false; error: string }

export type DongleFwCheckResponse = {
  ok: boolean
  hasUpdate: boolean
  size: string | number
  token?: string
  request?: Record<string, unknown> & { local?: LocalFwStatus }
  raw: DongleFwApiRaw
  error?: string
}
