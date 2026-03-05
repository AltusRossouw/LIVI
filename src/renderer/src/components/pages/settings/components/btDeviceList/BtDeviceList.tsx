import { useMemo } from 'react'
import { IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { StackItem } from '../stackItem'
import { useCarplayStore } from '@renderer/store/store'
import type { BoxInfoPayload, DevListEntry } from '@renderer/types'

const iconSx = { fontSize: 'clamp(22px, 4.2vh, 34px)' } as const
const btnSx = { padding: 'clamp(4px, 1.2vh, 10px)' } as const

const getConnectedMacFromBoxInfo = (boxInfo?: BoxInfoPayload): string => {
  return boxInfo?.btMacAddr?.trim() ?? ''
}

export const BtDeviceList = () => {
  const devices = useCarplayStore((s) => s.bluetoothPairedDevices)
  const remove = useCarplayStore((s) => s.removeBluetoothPairedDeviceLocal)
  const boxInfo = useCarplayStore((s) => s.boxInfo) as BoxInfoPayload | undefined

  const connectedMac = useMemo(() => getConnectedMacFromBoxInfo(boxInfo), [boxInfo])

  const sortedList = useMemo(() => {
    if (!Array.isArray(devices)) return []

    // Map each device to include type info
    const enriched = devices.map((d) => {
      const devEntry = boxInfo?.DevList?.find((b: DevListEntry) => b.id === d.mac)
      const type = devEntry?.type ?? 'Unknown'
      const index = Number(devEntry?.index ?? 999)
      return { ...d, type, index }
    })

    // Sort: connected device first, then by index
    return enriched.sort((a, b) => {
      if (a.mac === connectedMac) return -1
      if (b.mac === connectedMac) return 1
      return a.index - b.index
    })
  }, [devices, connectedMac, boxInfo])

  return (
    <>
      {sortedList.map((d) => {
        const name = d.name?.trim()
        const label = name && name.length > 0 ? name : 'Unknown device'
        const isConnected = d.mac === connectedMac

        return (
          <StackItem key={d.mac}>
            <Typography
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isConnected
                  ? (theme) => `${theme.palette.secondary.main} !important`
                  : 'text.primary'
              }}
            >
              {label} - {d.type}
            </Typography>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconButton sx={btnSx} onClick={() => remove(d.mac)}>
                <CloseIcon sx={iconSx} />
              </IconButton>
            </div>
          </StackItem>
        )
      })}
    </>
  )
}
