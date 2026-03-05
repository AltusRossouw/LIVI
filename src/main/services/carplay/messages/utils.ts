export const clamp = (number: number, min: number, max: number) => {
  return Math.max(min, Math.min(number, max))
}

export function getCurrentTimeInMs() {
  return Math.round(Date.now() / 1000)
}

export type AndroidAutoResolution = { width: number; height: number }

// Classic 5 tiers (as in AA dev settings)
// > 1080p only supported in wireless mode (Anroid 16)
export const AA_ALLOWED: AndroidAutoResolution[] = [
  { width: 800, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 }
]

/**
 * Always pick the highest Android Auto resolution tier that fits into the
 * user-provided "display size" (userRes). Rotation-safe (portrait/landscape).
 */
export function matchFittingAAResolution(userRes: {
  width: number
  height: number
}): AndroidAutoResolution {
  const displayLong = Math.max(userRes.width, userRes.height)
  const displayShort = Math.min(userRes.width, userRes.height)

  const sorted = [...AA_ALLOWED].sort((a, b) => {
    const aLong = Math.max(a.width, a.height)
    const aShort = Math.min(a.width, a.height)
    const bLong = Math.max(b.width, b.height)
    const bShort = Math.min(b.width, b.height)

    if (bLong !== aLong) return bLong - aLong
    return bShort - aShort
  })

  for (const r of sorted) {
    const rLong = Math.max(r.width, r.height)
    const rShort = Math.min(r.width, r.height)

    if (displayLong >= rLong && displayShort >= rShort) {
      return r
    }
  }

  // If 800x480 doesn't fit, return the smallest as a safe fallback
  return sorted[sorted.length - 1]
}
