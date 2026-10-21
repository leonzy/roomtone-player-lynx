import { getSongloftStorage } from '../../../core/storage/index.js'
import type { SongloftStorage } from '../../../core/storage/types.js'
import type { ScaleMode } from '../../../native/video.js'
import { createStore } from 'zustand/vanilla'

export const videoSubtitles = createStore<{ enabled: boolean }>(() => ({ enabled: true }))
const PREF_VIDEO_SUBTITLES = 'video_subtitles_enabled'
let subtitleRevision = 0
let subtitleWrites = Promise.resolve()

export async function loadVideoSubtitles(): Promise<void> {
  const revision = subtitleRevision
  try {
    await subtitleWrites
    const saved = await getSongloftStorage().prefs.get(PREF_VIDEO_SUBTITLES)
    if (revision === subtitleRevision) videoSubtitles.setState({ enabled: saved !== 'false' })
  } catch { /* Subtitles remain usable without persistent storage. */ }
}

export function changeVideoSubtitles(enabled: boolean): void {
  subtitleRevision++
  videoSubtitles.setState({ enabled })
  const storage = getSongloftStorage()
  subtitleWrites = subtitleWrites.then(() => storage.prefs.set(PREF_VIDEO_SUBTITLES, String(enabled))).catch(() => {})
}

export const PREF_VIDEO_SCALE_MODE = 'video_scale_mode'

export const DEFAULT_VIDEO_SCALE_MODE: ScaleMode = 'fit'

function coerce(value: unknown): ScaleMode {
  return value === 'zoom' ? 'zoom' : 'fit'
}

export async function readVideoScaleMode(
  storage: SongloftStorage = getSongloftStorage(),
): Promise<ScaleMode> {
  try {
    return coerce(await storage.prefs.get(PREF_VIDEO_SCALE_MODE))
  } catch {
    return DEFAULT_VIDEO_SCALE_MODE
  }
}

export async function writeVideoScaleMode(
  mode: ScaleMode,
  storage: SongloftStorage = getSongloftStorage(),
): Promise<void> {
  try {
    await storage.prefs.set(PREF_VIDEO_SCALE_MODE, mode)
  } catch {
    // best-effort
  }
}
