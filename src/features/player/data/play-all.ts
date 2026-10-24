import type { Song } from '../../../models/song.js'
import type { PlaybackContext } from '../domain/playback-context.js'
import { usePlayerStore } from '../store/index.js'

export interface PlayAllPage {
  songs: Song[]
  total: number
}

/**
 * First-page size for "play all". Flutter's `playPlaylistById` uses the same 10
 * so the first note does not wait for a list that can hold thousands of songs.
 */
export const PLAY_ALL_FIRST_PAGE = 10

/**
 * Start "play all" from a paginated source without serializing the whole list.
 *
 * Fetches only the first page, starts playback, then hands the remainder to the
 * store's background loader (100-song batches, Flutter `QueueLoader` parity).
 * Callers used to request `limit: 9999`, which made a big playlist download
 * every song before the first one played and froze the Lynx UI thread while the
 * response was parsed.
 *
 * Returns false when the source is empty; fetch errors propagate to the caller.
 */
export async function playAllWithBackgroundFill(
  fetchPage: (offset: number, limit: number) => Promise<PlayAllPage>,
  context?: PlaybackContext,
): Promise<boolean> {
  const first = await fetchPage(0, PLAY_ALL_FIRST_PAGE)
  if (first.songs.length === 0) return false
  const player = usePlayerStore.getState()
  // `playAll` re-bases the loader generation synchronously, so scheduling the
  // fill right after it targets the new queue. Await afterwards so playback
  // failures still reach the caller's toast.
  const playing = player.playAll(first.songs, context)
  player.loadRemainingSongsForCurrentPlaylist({
    loadedCount: first.songs.length,
    total: first.total,
    fetch: async (offset, limit) => (await fetchPage(offset, limit)).songs,
  })
  await playing
  return true
}
