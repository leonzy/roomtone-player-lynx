import type { Song } from '../../../models/song.js'
import type { PlaybackContext } from '../domain/playback-context.js'
import { usePlayerStore } from '../store/index.js'
import { collectQueueSongs } from './collection-queue.js'

export interface PlayAllPage {
  songs: Song[]
  total: number
}

export const PLAY_ALL_PAGE_SIZE = 200
let preparation = 0

/**
 * Prepare the complete collection in bounded requests, then replace exactly
 * once. Preparation never mutates playback or appends to the active queue.
 * A failed/incomplete source leaves the existing queue alone.
 */
export async function replaceCollectionQueue(
  fetchPage: (offset: number, limit: number) => Promise<PlayAllPage>,
  context?: PlaybackContext,
  initial?: PlayAllPage,
): Promise<boolean> {
  const generation = ++preparation
  const first = initial ?? await fetchPage(0, PLAY_ALL_PAGE_SIZE)
  if (first.songs.length === 0) return false
  const songs = await collectQueueSongs(first.songs, first.total, async (offset, limit) => {
    if (generation !== preparation) return []
    return (await fetchPage(offset, limit)).songs
  })
  if (generation !== preparation) return true
  if (songs.length < first.total) throw new Error('歌曲列表加载不完整，未替换播放队列，请重试')
  await usePlayerStore.getState().playAll(songs, context)
  return true
}
