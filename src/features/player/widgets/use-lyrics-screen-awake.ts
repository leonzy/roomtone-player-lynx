import { useEffect, useSyncExternalStore } from '@lynx-js/react'

import { setKeepScreenOn } from '../../../native/screen-awake.js'
import { loadLyricsScreenAwake, lyricsScreenAwake } from '../../settings/data/lyrics-screen-awake.js'

export function useLyricsScreenAwake(visible: boolean): void {
  const enabled = useSyncExternalStore(lyricsScreenAwake.subscribe, () => lyricsScreenAwake.getState().enabled)
  useEffect(() => { void loadLyricsScreenAwake() }, [])
  useEffect(() => {
    setKeepScreenOn(visible && enabled)
    return () => setKeepScreenOn(false)
  }, [visible, enabled])
}
