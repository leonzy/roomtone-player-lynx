import { createStore } from 'zustand/vanilla'

import { getSongloftStorage } from '../../../core/storage/index.js'
import type { SongloftStorage } from '../../../core/storage/types.js'

export const PREF_LYRICS_KEEP_SCREEN_ON = 'player_lyrics_keep_screen_on'
export const lyricsScreenAwake = createStore<{ enabled: boolean }>(() => ({ enabled: false }))
let revision = 0
let hydration = 0
let writes: Promise<void> = Promise.resolve()

export async function loadLyricsScreenAwake(storage: SongloftStorage = getSongloftStorage()): Promise<void> {
  const expectedRevision = revision
  const expectedHydration = ++hydration
  let saved: string | null = null
  try {
    await writes
    saved = await storage.prefs.get(PREF_LYRICS_KEEP_SCREEN_ON)
  } catch { /* Keep the default when storage is unavailable. */ }
  if (expectedRevision !== revision || expectedHydration !== hydration) return
  lyricsScreenAwake.setState({ enabled: saved === 'true' })
}

export function changeLyricsScreenAwake(enabled: boolean, storage: SongloftStorage = getSongloftStorage()): Promise<void> {
  revision++
  lyricsScreenAwake.setState({ enabled })
  writes = writes.then(() => storage.prefs.set(PREF_LYRICS_KEEP_SCREEN_ON, String(enabled))).catch(() => {})
  return writes
}
