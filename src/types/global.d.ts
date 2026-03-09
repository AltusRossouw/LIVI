export {}

declare global {
  interface Window {
    projection: {
      ipc: {
        sendCommand: (cmd: string) => void
      }
      usb: {
        listenForEvents: (...args: any[]) => void
        unlistenForEvents: (...args: any[]) => void
      }
    }
  }
}
