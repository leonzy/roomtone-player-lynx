import { getSongsApi, type LyricPayload } from '../../library/api/index.js'
import type { Song } from '../../../models/song.js'
import { apiPrefix } from '../../../core/config/app-config.js'
import { cachedSongIdentity } from '../domain/offline-cache.js'

// Persisted queues may predate provider registration or a metadata refresh.
// Online local songs have a stable endpoint even when their snapshot lacks it.
export function lyricUrlForSong(song: Song): string | undefined {
  if (song.lyricUrl) return song.lyricUrl
  if (song.type === 'local' && Number.isSafeInteger(song.id) && song.id > 0 && !cachedSongIdentity(song)) {
    return `${apiPrefix}/songs/${song.id}/lyric`
  }
  return undefined
}

/**
 * Options threaded through to `SongsApi.getLyric`. `refresh` is the user-facing
 * "re-fetch lyrics" signal: the backend re-runs its lyric search plugins and
 * disables response caching.
 */
export interface LyricFetchOptions {
  refresh?: boolean
}

/** Async lyric fetcher signature (injectable so the store is unit-testable). */
export type LyricFetcher = (song: Song, opts?: LyricFetchOptions) => Promise<LyricPayload>

/**
 * Production lyric fetcher: reuses the library feature's shared authenticated
 * client (Bearer + single-flight 401 refresh) via `SongsApi.getLyric`. Returns
 * an empty payload for remote/offline songs without a lyric URL. Online local
 * songs derive their endpoint instead of silently skipping lyric acquisition.
 */
export const defaultLyricFetcher: LyricFetcher = async (song, opts) => {
  const lyricUrl = lyricUrlForSong(song)
  if (!lyricUrl) return {}
  return getSongsApi().getLyric(lyricUrl, { refresh: opts?.refresh })
}
