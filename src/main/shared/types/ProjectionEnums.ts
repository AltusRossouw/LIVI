export enum CommandMapping {
  invalid = 0, // 'invalid'
  startRecordAudio = 1,
  stopRecordAudio = 2,
  requestHostUI = 3, // 'Projection interface My Car button clicked'
  siri = 5, // 'Siri Button'
  mic = 7, // 'Car Microphone'
  frame = 12,
  boxMic = 15, // 'Box Microphone'
  enableNightMode = 16,
  disableNightMode = 17,
  startGnssReport = 18,
  stopGnssReport = 19,
  phoneMic = 21, // 'Phone Microphone'
  audioTransferOn = 22, // Phone streams audio directly to car system, not dongle
  audioTransferOff = 23, // DEFAULT - Phone streams audio to dongle
  wifi24g = 24, // '2.4G Wifi'
  wifi5g = 25, // '5G Wifi'
  left = 100, // 'Button Left'
  right = 101, // 'Button Right'
  selectDown = 104, // 'Button Select Down'
  selectUp = 105, // 'Button Select Up'
  back = 106, // 'Button Back'
  up = 113, // 'Button Up'
  down = 114, // 'Button Down'
  home = 200, // 'Button Home'
  play = 201, // 'Button Play'
  pause = 202, // 'Button Pause'
  playPause = 203, // 'Button Toggle Play/Pause'
  next = 204, // 'Button Next Track'
  prev = 205, // 'Button Prev Track'
  acceptPhone = 300, // 'Accept Phone Call'
  rejectPhone = 301, // 'Reject Phone Call'
  requestVideoFocus = 500,
  releaseVideoFocus = 501,
  naviFocus = 506,
  naviRelease = 507,
  requestNaviScreenFocus = 508, // Request navigation screen
  releaseNaviScreenFocus = 509, // Release navigation screen
  wifiEnable = 1000,
  autoConnetEnable = 1001,
  wifiConnect = 1002,
  scanningDevice = 1003,
  deviceFound = 1004,
  deviceNotFound = 1005,
  connectDeviceFailed = 1006,
  btConnected = 1007,
  btDisconnected = 1008,
  wifiConnected = 1009,
  wifiDisconnected = 1010,
  btPairStart = 1011,
  wifiPair = 1012
}

export type CommandValue = keyof typeof CommandMapping

export enum AudioCommand {
  AudioOutputStart = 1,
  AudioOutputStop = 2,
  AudioInputConfig = 3,
  AudioPhonecallStart = 4,
  AudioPhonecallStop = 5,
  AudioNaviStart = 6,
  AudioNaviStop = 7,
  AudioSiriStart = 8,
  AudioSiriStop = 9,
  AudioMediaStart = 10,
  AudioMediaStop = 11,
  AudioAttentionStart = 12,
  AudioAttentionStop = 13,
  AudioAttentionRinging = 14,
  AudioTurnByTurnStart = 15,
  AudioTurnByTurnStop = 16
}

export enum TouchAction {
  Down = 14,
  Move = 15,
  Up = 16
}

export enum MultiTouchAction {
  Down = 1,
  Move = 2,
  Up = 0
}
