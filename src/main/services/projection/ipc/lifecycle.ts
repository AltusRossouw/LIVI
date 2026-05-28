import { registerIpcHandle } from '@main/ipc/register'
import type { ProjectionIpcHost } from './types'

type Deps = Pick<
  ProjectionIpcHost,
  'start' | 'stop' | 'restartSession' | 'pickPreferredTransport' | 'applyCodecCapabilities'
>

export function registerLifecycleIpc(host: Deps): void {
  registerIpcHandle('projection-start', async () => host.start())

  registerIpcHandle('projection-stop', async () => {
    if (host.pickPreferredTransport() === 'aa') return
    return host.stop()
  })

  registerIpcHandle('projection-restart', async () => host.restartSession())

  registerIpcHandle('projection-codec-capabilities', async (_evt, caps: unknown) => {
    host.applyCodecCapabilities(caps)
  })
}
