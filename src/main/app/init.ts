import { electronApp } from '@electron-toolkit/utils'

export function setupAppIdentity() {
  electronApp.setAppUserModelId('com.livi.app')
}
