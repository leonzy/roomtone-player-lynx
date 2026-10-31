import type { Song } from '../../../models/song.js'
import type { LyricState } from '../store/lyric-store.js'

interface DisplayState { currentSong?: Song; currentTime: number }
interface DisplayStore {
  getState(): DisplayState
  subscribe(listener: (state: DisplayState, previous: DisplayState) => void): () => void
}

/** Screen lyrics follow the selected zone, independently of the local engine. */
export function followPlayerLyrics(player: DisplayStore, lyrics: Pick<LyricState, 'loadForSong' | 'syncPosition'>, nativeUpdates: () => boolean) {
  let stopped = false
  const sync = (position: number) => {
    if (nativeUpdates()) lyrics.syncPosition(position)
    else lyrics.syncPosition(position, false)
  }
  const load = (song: Song | undefined) => {
    void Promise.resolve(lyrics.loadForSong(song)).then(() => {
      const current = player.getState()
      if (!stopped && current.currentSong === song) sync(current.currentTime)
    })
  }
  const unsubscribe = player.subscribe((state, previous) => {
    if (state.currentSong !== previous.currentSong) {
      load(state.currentSong)
    } else if (state.currentTime !== previous.currentTime) sync(state.currentTime)
  })
  // Persisted playback may be restored before this subscriber is installed.
  // Load it now instead of waiting for the next track or a manual re-fetch.
  const initial = player.getState().currentSong
  if (initial) load(initial)
  return () => { stopped = true; unsubscribe() }
}
