import { FC, PropsWithChildren } from 'react'
import { Nav } from '../navigation'
import { useCarplayStore } from '@store/store'
import { AppLayoutProps } from './types'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import WifiIcon from '@mui/icons-material/Wifi'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import { useBlinkingTime } from '../../hooks/useBlinkingTime'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'

export const AppLayout: FC<PropsWithChildren<AppLayoutProps>> = ({
  children,
  navRef,
  receivingVideo
}) => {
  const settings = useCarplayStore((s) => s.settings)
  const time = useBlinkingTime()
  const network = useNetworkStatus()

  // TODO move it to global UI constants
  const isVisibleTimeAndWifi = window.innerHeight > 320

  return (
    <div style={{ height: '100%', touchAction: 'none' }} id="main" className="App">
      <div ref={navRef} id="nav-root">
        {isVisibleTimeAndWifi && (
          <div
            style={{
              borderRight: '1px solid #444',
              paddingTop: '1rem'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
              <Typography style={{ fontSize: '1.5rem' }}>{time}</Typography>

              <div>
                {network.type === 'wifi' ? (
                  <WifiIcon fontSize="small" style={{ fontSize: '1rem' }} />
                ) : (
                  <>
                    {(network.type === 'cellular' || network.effectiveType) && (
                      <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <SignalCellularAltIcon fontSize="small" style={{ fontSize: '1rem' }} />
                        <Typography style={{ fontSize: '0.75rem' }}>
                          {network.effectiveType?.toUpperCase()}
                        </Typography>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Box>
          </div>
        )}
        <Nav receivingVideo={receivingVideo} settings={settings} />
      </div>

      {children}
    </div>
  )
}
