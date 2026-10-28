import type { Song } from '../../../models/song.js'

/** Show the containing folder without treating a stream URL as a file path. */
export function queueDirectory(song: Pick<Song, 'filePath'>): string {
  const raw = song.filePath?.trim()
  if (!raw || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return ''
  const path = raw.replace(/\\/g, '/')
  const end = path.lastIndexOf('/')
  if (end < 0) return ''
  return path.slice(0, end).replace(/^\/app\/music(?:\/|$)|^music\//, '') || '/'
}
