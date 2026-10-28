import type { Song } from '../../../models/song.js'
import type { LyricState } from '../store/lyric-store.js'

interface DisplayState { currentSong?: Song; currentTime: number }
interface DisplayStore {
  getState(): DisplayState
  subscribe(listener: (state: DisplayState, previous: DisplayState) => void): () => void
}

/** Screen lyrics follow the selected zone, independently of the local engine. */
export function followPlayerLyrics(player: DisplayStore, lyrics: Pick<LyricState, 'loadForSong' | 'syncPosition'>, nativeUpdates: () => boolean) {
  const sync = (position: number) => {
    if (nativeUpdates()) lyrics.syncPosition(position)
    else lyrics.syncPosition(position, false)
  }
  return player.subscribe((state, previous) => {
    if (state.currentSong !== previous.currentSong) {
      const song = state.currentSong
      void Promise.resolve(lyrics.loadForSong(song)).then(() => {
        const current = player.getState()
        if (current.currentSong === song) sync(current.currentTime)
      })
    } else if (state.currentTime !== previous.currentTime) sync(state.currentTime)
  })
}
