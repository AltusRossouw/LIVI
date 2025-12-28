import React from 'react'
import { useNavigate, useLocation } from 'react-router'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useStatusStore } from '../../store/store'
import { ExtraConfig } from '../../../../main/Globals'
import { useTabsConfig } from './useTabsConfig'
import { ROUTES } from '../../constants'
import { useBlinkingTime } from '../../hooks/useBlinkingTime'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import WifiIcon from '@mui/icons-material/Wifi'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'

interface NavProps {
  settings: ExtraConfig | null
  receivingVideo: boolean
}

export const Nav = ({ receivingVideo }: NavProps) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const time = useBlinkingTime()
  const network = useNetworkStatus()

  const isStreaming = useStatusStore((s) => s.isStreaming)
  const tabs = useTabsConfig(receivingVideo)

  if (isStreaming && pathname === ROUTES.HOME) return null

  const activeIndex = tabs.findIndex((t) => {
    if (t.path === ROUTES.HOME) {
      return pathname === ROUTES.HOME
    }
    return pathname.startsWith(t.path)
  })

  const value = activeIndex + 1 >= 1 ? activeIndex + 1 : 1

  const handleChange = (_: React.SyntheticEvent, newIndex: number) => {
    const tab = tabs[newIndex - 1]
    if (tab.path === ROUTES.QUIT) {
      window.carplay.quit().catch(console.error)
      return
    }
    navigate(tab.path)
  }

  const tabSx = {
    minWidth: 0,
    flex: '1 1 0',
    padding: '10px 0',
    '& .MuiTab-iconWrapper': { display: 'grid', placeItems: 'center' }
  } as const

  return (
    <>
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="Navigation Tabs"
        variant="fullWidth"
        textColor="inherit"
        visibleScrollbar={false}
        selectionFollowsFocus={false}
        orientation="vertical"
        sx={{
          borderRight: '1px solid',
          borderColor: 'divider',
          '& .MuiTabs-indicator': {
            display: 'none'
          }
        }}
      >
        <Tab
          aria-label={'time'}
          disabled={true}
          sx={tabSx}
          style={{ opacity: 1 }}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
              <Typography style={{ fontSize: '1.5rem' }}>{time}</Typography>

              <div>
                {network.type === 'wifi' ? (
                  <WifiIcon fontSize="small" />
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
          }
        />
        {tabs.map((tab) => (
          <Tab
            key={tab.path}
            sx={tabSx}
            icon={tab.icon}
            disabled={tab.disabled}
            aria-label={tab.label}
          />
        ))}
      </Tabs>
    </>
  )
}
