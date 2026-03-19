import { electronApp } from '@electron-toolkit/utils'
import { app } from 'electron'

export function setupAppIdentity() {
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  electronApp.setAppUserModelId('com.livi.app')
}
