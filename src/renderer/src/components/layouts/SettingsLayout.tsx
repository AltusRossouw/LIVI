import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ArrowBackIosOutlinedIcon from '@mui/icons-material/ArrowBackIosOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useNavigate } from 'react-router'
import { SettingsLayoutProps } from './types'

export const SettingsLayout = ({ children, title, onSave, isDirty }: SettingsLayoutProps) => {
  const navigate = useNavigate()

  const handleNavigate = () => navigate(-1)

  const handleSave = () => {
    const isRequireReset = onSave?.()
    if (isRequireReset) {
      console.log('need reset app')
    }
  }

  const showSave = Boolean(onSave) && isDirty

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,

        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,

        overflow: 'hidden',
        boxSizing: 'border-box',

        px: 'clamp(12px, 3.5vw, 28px)',
        pt: 'clamp(8px, 2.2vh, 18px)',
        pb: 'clamp(10px, 2.2vh, 18px)'
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'clamp(36px, 6vw, 56px) 1fr clamp(36px, 6vw, 56px)',
          alignItems: 'center',
          flex: '0 0 auto',
          mb: 'clamp(8px, 1.5vh, 16px)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            onClick={handleNavigate}
            aria-label="Back"
            sx={{
              width: 'clamp(32px, 5.5vw, 44px)',
              height: 'clamp(32px, 5.5vw, 44px)'
            }}
          >
            <ArrowBackIosOutlinedIcon />
          </IconButton>
        </Box>

        <Typography
          sx={{
            textAlign: 'center',
            fontWeight: 800,
            lineHeight: 1.05,
            fontSize: 'clamp(18px, 4.2vh, 42px)'
          }}
        >
          {title}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <IconButton
            onClick={handleSave}
            aria-label="Save"
            disabled={!showSave}
            sx={{
              width: 44,
              height: 44,
              opacity: showSave ? 1 : 0,
              pointerEvents: showSave ? 'auto' : 'none'
            }}
          >
            <SaveOutlinedIcon />
          </IconButton>
        </Box>
      </Box>

      {/* CONTENT */}
      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        <Stack spacing={0} sx={{ minHeight: 0 }}>
          {children}
        </Stack>
      </Box>
    </Box>
  )
}
