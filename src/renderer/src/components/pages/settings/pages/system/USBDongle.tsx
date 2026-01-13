import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from '@mui/material'
import { useCarplayStore, useStatusStore } from '@store/store'

type Row = {
  label: string
  value: string | number | null | undefined
  mono?: boolean
  tooltip?: string
}

type DevListEntry = {
  id?: string
  type?: string
  name?: string
  index?: string | number
  time?: string
  rfcomm?: string | number
}

type BoxInfoPayload = {
  uuid?: string
  MFD?: string
  boxType?: string
  OemName?: string
  productType?: string
  HiCar?: number
  supportLinkType?: string
  supportFeatures?: string
  hwVersion?: string
  WiFiChannel?: number
  CusCode?: string
  DevList?: DevListEntry[]
}

function normalizeBoxInfo(input: unknown): BoxInfoPayload | null {
  if (!input) return null

  if (typeof input === 'object') {
    return input as BoxInfoPayload
  }

  if (typeof input === 'string') {
    const s = input.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s)
      if (parsed && typeof parsed === 'object') return parsed as BoxInfoPayload
    } catch {
      // ignore
    }
  }

  return null
}

function fmt(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

type DongleFwApiRaw = {
  err: number
  token?: string
  ver?: string
  size?: string | number
  id?: string
  notes?: string
  forced?: number | boolean
  msg?: string
  error?: string
}

type DongleFwCheckResponse = {
  ok: boolean
  hasUpdate: boolean
  forced: boolean
  size: string | number
  token?: string
  request?: Record<string, unknown>
  raw: DongleFwApiRaw
  error?: string
}

function isDongleFwCheckResponse(v: unknown): v is DongleFwCheckResponse {
  if (!v || typeof v !== 'object') return false
  const o = v as any
  return typeof o.ok === 'boolean' && o.raw && typeof o.raw === 'object' && 'err' in o.raw
}

export function USBDongle() {
  const isDongleConnected = useStatusStore((s) => s.isDongleConnected)
  const isStreaming = useStatusStore((s) => s.isStreaming)

  // USB descriptor
  const vendorId = useCarplayStore((s) => s.vendorId)
  const productId = useCarplayStore((s) => s.productId)
  const usbFwVersion = useCarplayStore((s) => s.usbFwVersion)

  // Dongle Info
  const dongleFwVersion = useCarplayStore((s) => s.dongleFwVersion)
  const boxInfoRaw = useCarplayStore((s) => s.boxInfo)

  // Video stream (negotiated)
  const negotiatedWidth = useCarplayStore((s) => s.negotiatedWidth)
  const negotiatedHeight = useCarplayStore((s) => s.negotiatedHeight)

  // Audio stream
  const audioCodec = useCarplayStore((s) => s.audioCodec)
  const audioSampleRate = useCarplayStore((s) => s.audioSampleRate)
  const audioChannels = useCarplayStore((s) => s.audioChannels)
  const audioBitDepth = useCarplayStore((s) => s.audioBitDepth)

  const boxInfo = useMemo(() => normalizeBoxInfo(boxInfoRaw), [boxInfoRaw])
  const devList = useMemo(
    () => (Array.isArray(boxInfo?.DevList) ? (boxInfo?.DevList ?? []) : []),
    [boxInfo]
  )

  const resolution =
    negotiatedWidth && negotiatedHeight ? `${negotiatedWidth}×${negotiatedHeight}` : '—'

  const audioLine = useMemo(() => {
    const parts: string[] = []
    if (audioCodec) parts.push(String(audioCodec))
    if (audioSampleRate) parts.push(`${audioSampleRate} Hz`)
    if (audioChannels != null) parts.push(`${audioChannels} ch`)
    if (audioBitDepth) parts.push(`${audioBitDepth} bit`)
    return parts.length ? parts.join(' • ') : '—'
  }, [audioCodec, audioSampleRate, audioChannels, audioBitDepth])

  const Mono: CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontVariantNumeric: 'tabular-nums'
  }

  // Dongle FW check/update UI state
  const [fwBusy, setFwBusy] = useState<null | 'check' | 'update'>(null)
  const [fwResult, setFwResult] = useState<DongleFwCheckResponse | null>(null)
  const [fwUiError, setFwUiError] = useState<string | null>(null)

  // Changelog dialog UI state
  const [changelogOpen, setChangelogOpen] = useState(false)

  const ok = Boolean(fwResult?.ok) && fwResult?.raw?.err === 0
  const latestVer = typeof fwResult?.raw?.ver === 'string' ? fwResult.raw.ver.trim() : ''
  const forced = Boolean(fwResult?.forced)
  const notes = typeof fwResult?.raw?.notes === 'string' ? fwResult.raw.notes : undefined
  const hasUpdate = Boolean(fwResult?.hasUpdate) && latestVer.length > 0
  const latestFwLabel = ok ? (hasUpdate ? latestVer : '—') : '—'
  const hasChangelog = typeof notes === 'string' && notes.trim().length > 0

  const fwStatusText = useMemo(() => {
    if (fwBusy === 'check') return 'Checking…'
    if (fwBusy === 'update') return 'Starting update…'
    if (!fwResult) return '—'

    if (!fwResult.ok || fwResult.raw?.err !== 0) {
      const msg =
        (fwResult.raw as any)?.msg ||
        (fwResult.raw as any)?.error ||
        fwResult.error ||
        'Unknown error'
      return `Error: ${String(msg)}`
    }

    if (hasUpdate) return forced ? 'Update available (forced)' : 'Update available'
    return 'Up to date'
  }, [fwBusy, fwResult, hasUpdate, forced])

  const canCheck =
    fwBusy == null &&
    Boolean(isDongleConnected) &&
    Boolean(fmt(dongleFwVersion)) &&
    Boolean(fmt(boxInfo?.uuid)) &&
    Boolean(fmt(boxInfo?.MFD)) &&
    Boolean(fmt(boxInfo?.productType))

  const handleFwAction = useCallback(
    async (action: 'check' | 'update') => {
      setFwUiError(null)

      try {
        setFwBusy(action)

        // Call preload -> main IPC
        const raw = await window.carplay.ipc.dongleFirmware(action)
        console.log('[DongleInfo] dongleFirmware raw =', raw)

        if (!isDongleFwCheckResponse(raw)) {
          setFwResult(null)
          setFwUiError(`Invalid response from main process (type=${typeof raw})`)
          return
        }

        setFwResult(raw)

        if (!raw.ok || raw.raw?.err !== 0) {
          const msg =
            (raw.raw as any)?.msg || (raw.raw as any)?.error || raw.error || 'Unknown error'
          setFwUiError(String(msg))
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setFwUiError(msg)
        setFwResult(null)
      } finally {
        setFwBusy(null)
      }
    },
    [setFwBusy]
  )

  const rowsTop = useMemo<Row[]>(
    () => [
      { label: 'Dongle', value: isDongleConnected ? 'Connected' : 'Not connected' },
      { label: 'Phone', value: isStreaming ? 'Connected' : 'Not connected' }
    ],
    [isDongleConnected, isStreaming]
  )

  const rowsUsb = useMemo<Row[]>(
    () => [
      {
        label: 'USB Vendor',
        value: vendorId != null ? `0x${vendorId.toString(16)}` : '—',
        mono: true
      },
      {
        label: 'USB Product',
        value: productId != null ? `0x${productId.toString(16)}` : '—',
        mono: true
      },
      { label: 'USB FW', value: usbFwVersion, mono: true }
    ],
    [vendorId, productId, usbFwVersion]
  )

  const rowsFw = useMemo<Row[]>(
    () => [
      { label: 'Dongle FW', value: dongleFwVersion, mono: true },
      { label: 'Latest FW', value: latestFwLabel, mono: true },
      { label: 'FW Status', value: fwStatusText, mono: true }
    ],
    [dongleFwVersion, latestFwLabel, fwStatusText]
  )

  const rowsDongleInfo = useMemo<Row[]>(
    () => [
      { label: 'UUID', value: fmt(boxInfo?.uuid), mono: true },
      { label: 'MFD', value: fmt(boxInfo?.MFD), mono: true },
      { label: 'ProductType', value: fmt(boxInfo?.productType), mono: true },
      { label: 'HW', value: fmt(boxInfo?.hwVersion), mono: true },
      { label: 'BoxType', value: fmt(boxInfo?.boxType) },
      { label: 'OEM', value: fmt(boxInfo?.OemName) },
      { label: 'WiFi Channel', value: boxInfo?.WiFiChannel ?? null, mono: true },
      { label: 'Links', value: fmt(boxInfo?.supportLinkType) },
      { label: 'Features', value: fmt(boxInfo?.supportFeatures) },
      { label: 'CusCode', value: fmt(boxInfo?.CusCode), mono: true }
    ],
    [boxInfo]
  )

  const rowsStreams = useMemo<Row[]>(
    () => [
      { label: 'Resolution', value: resolution, mono: true },
      { label: 'Audio', value: audioLine, mono: true }
    ],
    [resolution, audioLine]
  )

  const renderRows = (rows: Row[]) => (
    <Stack spacing={0.5}>
      {rows.map((r) => {
        const text = r.value != null && String(r.value).trim() ? String(r.value) : '—'
        const title = r.tooltip ?? (typeof r.value === 'string' ? r.value : '')

        return (
          <Box
            key={r.label}
            tabIndex={0}
            role="listitem"
            aria-label={`${r.label}: ${text}`}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 1,
              px: 1,
              py: 0.75,
              borderRadius: 1.25,
              outline: 'none',
              '&:focus-visible': {
                bgcolor: 'action.selected'
              }
            }}
          >
            <Typography sx={{ minWidth: 140 }} color="text.secondary">
              {r.label}:
            </Typography>

            <Typography
              title={title}
              sx={{
                ...(r.mono ? Mono : null),
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '52ch'
              }}
            >
              {text}
            </Typography>
          </Box>
        )
      })}
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        Firmware
      </Typography>

      {renderRows(rowsFw)}

      {/* FW actions */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', px: 1 }}>
        <Button
          variant="outlined"
          size="small"
          disabled={!canCheck}
          onClick={() => handleFwAction('check')}
        >
          {fwBusy === 'check' ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={14} />
              Check for Updates
            </Box>
          ) : (
            'Check for Updates'
          )}
        </Button>

        <Button
          variant="contained"
          size="small"
          disabled={!hasUpdate || fwBusy != null}
          onClick={() => handleFwAction('update')}
        >
          {fwBusy === 'update' ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={14} />
              Update
            </Box>
          ) : forced ? (
            'Update (forced)'
          ) : (
            'Update'
          )}
        </Button>

        <Button
          variant="text"
          size="small"
          disabled={!hasChangelog}
          onClick={() => setChangelogOpen(true)}
        >
          Changelog
        </Button>
      </Stack>

      {/* Changelog dialog (vendor-provided, optional) */}
      <Dialog open={changelogOpen} onClose={() => setChangelogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Vendor changelog</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            This information is provided by the dongle vendor and may be incomplete or untranslated.
          </Typography>

          <Typography variant="body2" sx={{ ...Mono, whiteSpace: 'pre-wrap' }}>
            {notes?.trim() || '—'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setChangelogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {fwUiError ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {fwUiError}
        </Alert>
      ) : null}

      <Divider />

      {renderRows(rowsTop)}

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Streams
      </Typography>
      {renderRows(rowsStreams)}

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        USB Descriptor
      </Typography>
      {renderRows(rowsUsb)}

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Dongle Info
      </Typography>

      {renderRows(rowsDongleInfo)}

      <Typography variant="subtitle2" color="text.secondary">
        Paired / Connected Devices
      </Typography>

      {devList.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          — (no devices reported)
        </Typography>
      ) : (
        <Stack spacing={1}>
          {devList.map((d, i) => {
            const idx = fmt(d.index) ?? String(i + 1)
            const name = fmt(d.name) ?? '—'
            const type = fmt(d.type) ?? '—'
            const id = fmt(d.id) ?? '—'
            const time = fmt(d.time) ?? '—'
            const rfcomm = fmt(d.rfcomm) ?? '—'

            return (
              <Box
                key={`${idx}-${id}-${i}`}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.75
                }}
              >
                <Typography sx={{ ...Mono }}>
                  #{idx} • {name}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ ...Mono }}>
                  {type} • {id}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ ...Mono }}>
                  time={time} • rfcomm={rfcomm}
                </Typography>
              </Box>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
