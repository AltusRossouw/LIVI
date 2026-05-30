import { app } from 'electron'
import { linuxPresetAngleVulkan } from '../utils'

// Linux x64 -> ANGLE + Vulkan for the UI compositor
if (process.platform === 'linux' && process.arch === 'x64') {
  commonGpuToggles()
  linuxPresetAngleVulkan()
}

export function commonGpuToggles() {
  app.commandLine.appendSwitch('ignore-gpu-blocklist')
  app.commandLine.appendSwitch('enable-gpu-rasterization')
}
