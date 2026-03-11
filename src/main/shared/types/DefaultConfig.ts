import type { ExtraConfig } from '@shared/types'
import { DEFAULT_BINDINGS } from '@shared/types'
import { ICON_120_B64, ICON_180_B64, ICON_256_B64 } from '@shared/assets/carIcons'
import { HandDriveType, MicType, PhoneWorkMode } from '@shared/types/DongleConfig'

export const DEFAULT_EXTRA_CONFIG: ExtraConfig = {
  width: 800,
  height: 480,
  fps: 60,
  dpi: 160,
  lastPhoneWorkMode: PhoneWorkMode.CarPlay,
  apkVer: '2025.03.19.1126',
  carName: 'LIVI',
  oemName: 'App',
  nightMode: true,
  hand: HandDriveType.LHD,
  mediaDelay: 1000,
  mediaSound: 1,
  callQuality: 1,
  // Currently disabled:
  // riddleBoxCfg uses `riddleBoxCfg -s AutoPlauMusic 1`, but setting it does not work.
  // Likely vendor typo or firmware-side bug.
  // autoPlay: true,
  autoConn: true,
  mapsEnabled: false,
  audioTransferMode: false,
  wifiType: '5ghz',
  wifiChannel: 36,
  micType: MicType.CarMic,
  phoneConfig: {},

  startPage: 'home',
  kiosk: true,
  uiZoomPercent: 100,
  camera: '',
  telemetryEnabled: false,
  telemetryDashboards: [],
  cameraMirror: false,
  bindings: DEFAULT_BINDINGS,
  audioVolume: 0.95,
  navVolume: 0.95,
  siriVolume: 0.95,
  callVolume: 0.95,
  autoSwitchOnStream: false,
  autoSwitchOnPhoneCall: true,
  autoSwitchOnGuidance: true,
  visualAudioDelayMs: 120,
  language: 'en',

  dongleIcon120: ICON_120_B64,
  dongleIcon180: ICON_180_B64,
  dongleIcon256: ICON_256_B64
}
