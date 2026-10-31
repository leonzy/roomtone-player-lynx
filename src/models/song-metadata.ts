import type { Song } from './song.js'

/** Replace metadata without changing queue entry fields or offline snapshots. */
export function updatedSong(current: Song | undefined, saved: Song): Song | undefined {
  if (!current || current.id !== saved.id || current.type !== saved.type || 'deviceCache' in current) return current
  if (Object.keys(saved).every(key => Object.is(current[key as keyof Song], saved[key as keyof Song]))) return current
  return { ...current, ...saved }
}

/** Known query containers include flat lists, infinite pages and song details. */
export function patchSongMetadata(data: unknown, saved: Song): unknown {
  if (Array.isArray(data)) {
    const next = data.map(value => patchSongMetadata(value, saved))
    return next.some((value, index) => value !== data[index]) ? next : data
  }
  if (!data || typeof data !== 'object') return data
  const record = data as Record<string, unknown>
  if (record.id === saved.id && record.type === saved.type && typeof record.title === 'string') return updatedSong(data as Song, saved)
  let next = record
  for (const key of ['pages', 'items', 'songs', 'song', 'data']) {
    if (!(key in record)) continue
    const value = patchSongMetadata(record[key], saved)
    if (value !== record[key]) next = { ...next, [key]: value }
  }
  return next
}
