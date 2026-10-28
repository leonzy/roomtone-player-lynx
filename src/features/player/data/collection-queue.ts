import type { Song } from '../../../models/song.js'

/** Fetch the entire displayed source, retaining its order rather than only its loaded page. */
export async function collectQueueSongs(initial: readonly Song[], total: number, fetch: (offset: number, limit: number) => Promise<Song[]>): Promise<Song[]> {
  const songs = [...initial]
  while (songs.length < total) {
    const page = await fetch(songs.length, Math.min(200, total - songs.length))
    if (!page.length) break
    songs.push(...page)
  }
  return songs
}
