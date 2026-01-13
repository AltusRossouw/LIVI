import { net } from 'electron'

export type FirmwareCheckInput = {
  appVer: string
  lang?: number
  code?: number
  dongleFwVersion?: string | null
  boxInfo?: unknown
}

export type FirmwareCheckResult =
  | {
      ok: true
      hasUpdate: boolean
      latestVer?: string
      forced?: boolean
      notes?: string
      size?: number
      id?: string
      token?: string
      request?: {
        lang: number
        code: number
        appVer: string
        ver: string
        uuid: string
        mfd: string
        fwn: string
        model: string
      }
      raw: unknown
    }
  | { ok: false; error: string }

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
  if (typeof input === 'object') return input as BoxInfoPayload
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

function toInt(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export class FirmwareUpdateService {
  private readonly apiUrl = 'http://api.paplink.cn/a/upgrade/checkBox'

  public async checkForUpdate(input: FirmwareCheckInput): Promise<FirmwareCheckResult> {
    const lang = typeof input.lang === 'number' ? input.lang : 0
    const code = typeof input.code === 'number' ? input.code : 37
    const appVer = input.appVer

    const ver = fmt(input.dongleFwVersion)
    const box = normalizeBoxInfo(input.boxInfo)

    const uuid = fmt(box?.uuid)
    const mfd = fmt(box?.MFD)
    const model = fmt(box?.productType)

    if (!appVer) return { ok: false, error: 'Missing appVer' }
    if (!ver) return { ok: false, error: 'Missing dongleFwVersion (ver)' }
    if (!uuid) return { ok: false, error: 'Missing boxInfo.uuid' }
    if (!mfd) return { ok: false, error: 'Missing boxInfo.MFD' }
    if (!model) return { ok: false, error: 'Missing boxInfo.productType (model)' }

    const fwn = `${model}_Update.img`

    const form = new URLSearchParams()
    form.set('lang', String(lang))
    form.set('code', String(code))
    form.set('appVer', appVer)
    form.set('ver', ver)
    form.set('uuid', uuid)
    form.set('mfd', mfd)
    form.set('fwn', fwn)
    form.set('model', model)

    try {
      const rawText = await this.httpPostForm(this.apiUrl, form.toString())
      const raw = this.safeJson(rawText)

      // expected: { err:0, token, ver, size, id, notes, forced }
      const err = raw && typeof raw === 'object' ? (raw as any).err : null
      if (err !== 0) {
        return { ok: false, error: `checkBox err=${String(err ?? 'unknown')}` }
      }

      const latestVer = fmt((raw as any).ver)
      const forced = Boolean((raw as any).forced)
      const notes = fmt((raw as any).notes)
      const size = toInt((raw as any).size)
      const id = fmt((raw as any).id)
      const token = fmt((raw as any).token)

      const hasUpdate = latestVer != null && latestVer !== ver

      return {
        ok: true,
        hasUpdate,
        latestVer: latestVer ?? undefined,
        forced,
        notes: notes ?? undefined,
        size: size ?? undefined,
        id: id ?? undefined,
        token: token ?? undefined,
        request: { lang, code, appVer, ver, uuid, mfd, fwn, model },
        raw
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  }

  public async startUpdate(_input: FirmwareCheckInput): Promise<void> {
    // Dummy for now.
    // Real implementation (download + flash) will be added later in this file.
    throw new Error('Firmware update is not implemented yet')
  }

  private safeJson(text: string): unknown {
    try {
      return JSON.parse(text)
    } catch {
      return { err: -1, raw: text }
    }
  }

  private httpPostForm(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = net.request({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      let data = ''
      req.on('response', (res) => {
        res.on('data', (chunk) => (data += chunk.toString('utf8')))
        res.on('end', () => resolve(data))
      })
      req.on('error', (err) => reject(err))

      req.write(body)
      req.end()
    })
  }
}
