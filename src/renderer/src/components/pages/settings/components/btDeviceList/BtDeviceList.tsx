import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { IconButton, Typography } from '@mui/material'
import { useLiviStore } from '@renderer/store/store'
import type { BoxInfoPayload, DevListEntry } from '@renderer/types'
import { PhoneWorkMode } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StackItem } from '../stackItem'

const iconSx = { fontSize: 'clamp(22px, 4.2vh, 34px)' } as const
const btnSx = { padding: 'clamp(4px, 1.2vh, 10px)' } as const

const normalizeMac = (value?: string): string => {
  return value?.trim().toUpperCase() ?? ''
}

// 0x04 = Audio/Video CoD major class
const BT_COD_MAJOR_AUDIO = 0x04
const isAudioDevice = (cod: number | undefined | null): boolean => {
  if (typeof cod !== 'number' || cod <= 0) return false
  return ((cod >> 8) & 0x1f) === BT_COD_MAJOR_AUDIO
}

const getConnectedMacFromBoxInfo = (boxInfo?: BoxInfoPayload): string => {
  return normalizeMac(boxInfo?.btMacAddr)
}

export const BtDeviceList = () => {
  const devices = useLiviStore((s) => s.bluetoothPairedDevices)
  const boxInfo = useLiviStore((s) => s.boxInfo) as BoxInfoPayload | undefined
  const connectedMac = useMemo(() => getConnectedMacFromBoxInfo(boxInfo), [boxInfo])
  const [pendingConnectMac, setPendingConnectMac] = useState<string>('')
  const deviceMetaCacheRef = useRef<
    Record<
      string,
      {
        type?: string
        index?: number
        source?: 'dongle' | 'host'
        class?: number
        connected?: boolean
      }
    >
  >({})

  const remove = useLiviStore((s) => s.forgetBluetoothPairedDevice)

  const connect = useLiviStore((s) => s.connectBluetoothPairedDevice)
  const saveSettings = useLiviStore((s) => s.saveSettings)

  useEffect(() => {
    const devList = Array.isArray(boxInfo?.DevList) ? boxInfo.DevList : []

    for (const entry of devList) {
      const mac = normalizeMac((entry as DevListEntry).id)
      if (!mac) continue

      deviceMetaCacheRef.current[mac] = {
        type: (entry as DevListEntry).type,
        index: Number((entry as DevListEntry).index ?? 999),
        source: (entry as DevListEntry).source,
        class: (entry as DevListEntry).class,
        connected: (entry as DevListEntry).connected
      }
    }

    if (connectedMac) {
      setPendingConnectMac('')
    }
  }, [boxInfo, connectedMac])

  const sortedList = useMemo(() => {
    if (!Array.isArray(devices)) return []

    const enriched = devices.map((d) => {
      const mac = normalizeMac(d.mac)
      const devEntry = boxInfo?.DevList?.find((b: DevListEntry) => normalizeMac(b.id) === mac)
      const cached = deviceMetaCacheRef.current[mac]

      const type = devEntry?.type ?? cached?.type ?? 'Unknown'
      const index = Number(devEntry?.index ?? cached?.index ?? 999)
      const source = (devEntry as DevListEntry | undefined)?.source ?? cached?.source
      const cod = (devEntry as DevListEntry | undefined)?.class ?? cached?.class
      const btConnected =
        (devEntry as DevListEntry | undefined)?.connected ?? cached?.connected ?? false
      const targetPhoneWorkMode =
        type === 'AndroidAuto' ? PhoneWorkMode.Android : PhoneWorkMode.CarPlay

      return { ...d, mac, type, index, source, cod, btConnected, targetPhoneWorkMode }
    })

    return enriched.sort((a, b) => a.index - b.index)
  }, [devices, boxInfo])

  const phones = useMemo(() => sortedList.filter((d) => !isAudioDevice(d.cod)), [sortedList])

  const renderItem = (d: (typeof sortedList)[number]) => {
    const name = d.name?.trim()
    const baseLabel = name && name.length > 0 ? name : 'Unknown device'
    const label = d.source === 'dongle' ? `${baseLabel} (D)` : baseLabel
    const isConnected = d.mac === connectedMac
    const isConnecting = d.mac === pendingConnectMac
    const isSwitching = pendingConnectMac.length > 0

    return (
      <StackItem key={d.mac}>
        <Typography
          component="p"
          sx={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            flex: 1
          }}
        >
          <span
            style={{
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isConnected ? 'var(--ui-highlight)' : 'inherit'
            }}
          >
            {label}
          </span>
        </Typography>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton
            sx={btnSx}
            disabled={isConnected || isSwitching}
            onClick={async () => {
              setPendingConnectMac(d.mac)

              if (d.source === 'host') {
                // BT-connect, then let the arbiter swap to wireless AA
                const ok = await connect(d.mac)
                if (!ok) {
                  setPendingConnectMac('')
                  return
                }
                try {
                  await window.projection.ipc.switchTransport?.()
                } catch (e) {
                  console.warn('[BtDeviceList] switchTransport failed', e)
                  setPendingConnectMac('')
                }
                return
              }

              // Dongle path
              await saveSettings({ lastPhoneWorkMode: d.targetPhoneWorkMode })
              const ok = await connect(d.mac)
              if (!ok) {
                setPendingConnectMac('')
                return
              }
              try {
                await window.projection.usb.forceReset()
              } catch (e) {
                console.warn('[BtDeviceList] usb.forceReset() failed', e)
                setPendingConnectMac('')
              }
            }}
          >
            <LinkIcon
              sx={{
                ...iconSx,
                opacity: isConnected || isSwitching ? 0.3 : 1,
                color: isConnected || isSwitching ? 'action.disabled' : 'inherit',
                transition: isConnecting ? 'none !important' : undefined,
                ...(isConnecting
                  ? {
                      opacity: 'var(--ui-breathe-opacity, 1)',
                      color: 'var(--ui-highlight)'
                    }
                  : {})
              }}
            />
          </IconButton>

          <IconButton sx={btnSx} disabled={isSwitching} onClick={() => remove(d.mac)}>
            <CloseIcon
              sx={{
                ...iconSx,
                opacity: isSwitching ? 0.3 : 1,
                color: isSwitching ? 'action.disabled' : 'inherit'
              }}
            />
          </IconButton>
        </div>
      </StackItem>
    )
  }

  return <>{phones.map(renderItem)}</>
}
