import { getSongloftStorage } from '../../../core/storage/index.js'
import type { SongloftStorage } from '../../../core/storage/types.js'

/**
 * prefs key for the app-level volume. The same key the server-side user
 * preference sync uses (`player_volume`), so the value written here and the one
 * a synced account pushes match — and the Flutter client reads it too.
 */
export const PREF_VOLUME = 'player_volume'

/** Coerce a stored value into the 0–100 range; anything malformed reads as "unset". */
export function coerceVolume(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, Math.round(value)))
}

export async function readVolume(
  storage: SongloftStorage = getSongloftStorage(),
): Promise<number | null> {
  try {
    return coerceVolume(await storage.prefs.get(PREF_VOLUME))
  } catch {
    return null
  }
}

export async function writeVolume(
  volume: number,
  storage: SongloftStorage = getSongloftStorage(),
): Promise<void> {
  const clamped = Math.min(100, Math.max(0, Math.round(volume)))
  try {
    await storage.prefs.set(PREF_VOLUME, String(clamped))
  } catch {
    // best-effort, like the other preference writers
  }
}
