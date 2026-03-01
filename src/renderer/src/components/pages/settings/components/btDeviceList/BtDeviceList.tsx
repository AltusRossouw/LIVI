import { useMemo } from 'react'
import { IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { StackItem } from '../stackItem'
import { useCarplayStore } from '@renderer/store/store'

const iconSx = { fontSize: 'clamp(22px, 4.2vh, 34px)' } as const
const btnSx = { padding: 'clamp(4px, 1.2vh, 10px)' } as const

const getConnectedMacFromBoxInfo = (boxInfo: unknown): string => {
  if (!boxInfo || typeof boxInfo !== 'object') return ''
  const rec = boxInfo as Record<string, unknown>
  const v = rec.btMacAddr
  return typeof v === 'string' ? v.trim() : ''
}

export const BtDeviceList = () => {
  const devices = useCarplayStore((s) => s.bluetoothPairedDevices)
  const remove = useCarplayStore((s) => s.removeBluetoothPairedDeviceLocal)
  const boxInfo = useCarplayStore((s) => s.boxInfo)

  const list = useMemo(() => (Array.isArray(devices) ? devices : []), [devices])
  const connectedMac = useMemo(() => getConnectedMacFromBoxInfo(boxInfo), [boxInfo])

  return (
    <>
      {list.map((d) => {
        const name = d.name?.trim()
        const label = name && name.length > 0 ? name : 'Unknown device'
        const isConnected = Boolean(connectedMac) && d.mac === connectedMac

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
              {label}
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
