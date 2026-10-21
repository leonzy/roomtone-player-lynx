import { createStore } from 'zustand/vanilla'

import { getSongloftStorage } from '../../../core/storage/index.js'

export const MINI_PLAYER_CONTROLS = ['playOnly', 'prevNext', 'prevNextMode'] as const
export type MiniPlayerControls = (typeof MINI_PLAYER_CONTROLS)[number]
export const PREF_MINI_PLAYER_CONTROLS = 'mini_player_controls'

export const miniPlayerControls = createStore<{ mode: MiniPlayerControls }>(() => ({
  mode: 'prevNext',
}))
let revision = 0
let writes = Promise.resolve()

export async function loadMiniPlayerControls(): Promise<void> {
  const expected = revision
  try {
    await writes
    const saved = await getSongloftStorage().prefs.get(PREF_MINI_PLAYER_CONTROLS)
    if (expected !== revision) return
    miniPlayerControls.setState({
      mode: MINI_PLAYER_CONTROLS.includes(saved as MiniPlayerControls)
        ? (saved as MiniPlayerControls)
        : 'prevNext',
    })
  } catch {
    /* Keep the current layout when storage is unavailable. */
  }
}

export function changeMiniPlayerControls(mode: MiniPlayerControls): void {
  revision++
  miniPlayerControls.setState({ mode })
  const storage = getSongloftStorage()
  writes = writes.then(() => storage.prefs.set(PREF_MINI_PLAYER_CONTROLS, mode)).catch(() => {})
}
