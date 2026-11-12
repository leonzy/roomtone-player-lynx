import type { Song } from '../../../models/song.js'

/** Current occurrence still belongs to the remaining queue, even on a replay. */
export function queueProgress(songs: readonly Song[], current: number, started: readonly number[] = []) {
  const played = new Set(started.filter(index => Number.isInteger(index) && index >= 0 && index < songs.length && index !== current))
  const remaining = songs.filter((_, index) => !played.has(index))
  return { played, remaining: remaining.length, duration: remaining.reduce((sum, song) => sum + (song.duration ?? 0), 0) }
}
