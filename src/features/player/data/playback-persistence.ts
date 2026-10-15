import { getSongloftStorage } from '../../../core/storage/index.js'
import type { SongloftStorage } from '../../../core/storage/types.js'
import type { Song } from '../../../models/song.js'
import { songToJson, songSchema } from '../../../models/song.js'
import { cachedSongIdentity, parseCachedIdentity, snapshotCachedSong } from '../domain/offline-cache.js'
import {
  playlistContext,
  type PlaybackContext,
  playlistIdOf,
} from '../domain/playback-context.js'

const PREF_PLAYBACK_QUEUE = 'playback_queue'
const PREF_OFFLINE_PLAYBACK_QUEUE = 'device_cache_playback_queue_v1'
const PREF_PLAYBACK_INDEX = 'playback_index'
const PREF_PLAYBACK_POSITION = 'playback_position'
const PREF_PLAYBACK_CONTEXT = 'playback_context'
/**
 * Superseded by {@link PREF_PLAYBACK_CONTEXT}, which stores the full
 * `(type, key)` pair instead of a playlist ID alone. Still read so an upgrade
 * keeps the restored queue's context, and removed on the next write.
 */
const PREF_PLAYBACK_SOURCE_PLAYLIST = 'playback_source_playlist'

let writes: Promise<void> = Promise.resolve()
// Store queues are immutable. Position/index updates must not re-encode or send
// tens of thousands of unchanged songs through the native bridge every 10s.
let savedQueue: { storage: SongloftStorage, playlist: Song[], offline: boolean } | null = null
export function clearSavedPlaybackState(storage: SongloftStorage = getSongloftStorage()): Promise<void> {
  writes = writes.catch(() => {}).then(async () => {
    savedQueue = null
    // PrimJS on native does not provide Promise.allSettled.
    await Promise.all([PREF_PLAYBACK_QUEUE, PREF_OFFLINE_PLAYBACK_QUEUE, PREF_PLAYBACK_INDEX, PREF_PLAYBACK_POSITION,
      PREF_PLAYBACK_CONTEXT, PREF_PLAYBACK_SOURCE_PLAYLIST].map(key => storage.prefs.remove(key).catch(() => {})))
  })
  return writes
}

export interface SavedPlaybackState {
  playlist: Song[]
  currentIndex: number
  positionMs: number
  context?: PlaybackContext
  /** Derived from {@link context}; see `PlayerData.sourcePlaylistId`. */
  sourcePlaylistId?: number
}

/**
 * Parses the persisted context, tolerating anything.
 *
 * In its own try on purpose: folding this into the caller's would turn one bad
 * pref into "the whole restored queue is gone".
 */
function parseSavedContext(json: string | null | undefined): PlaybackContext | undefined {
  if (!json) return undefined
  try {
    const raw = JSON.parse(json) as { type?: unknown, key?: unknown }
    if (typeof raw?.type !== 'string' || typeof raw?.key !== 'string') return undefined
    if (!raw.type || !raw.key) return undefined
    return { type: raw.type as PlaybackContext['type'], key: raw.key }
  } catch {
    return undefined
  }
}

export async function loadPlaybackState(): Promise<SavedPlaybackState | null> {
  try {
    const storage = getSongloftStorage()
    const [queueJson, indexStr, posStr, contextJson, playlistIdStr, offlineJson] = await Promise.all([
      storage.prefs.get(PREF_PLAYBACK_QUEUE),
      storage.prefs.get(PREF_PLAYBACK_INDEX),
      storage.prefs.get(PREF_PLAYBACK_POSITION),
      storage.prefs.get(PREF_PLAYBACK_CONTEXT),
      storage.prefs.get(PREF_PLAYBACK_SOURCE_PLAYLIST),
      storage.prefs.get(PREF_OFFLINE_PLAYBACK_QUEUE),
    ])

    if (!queueJson && !offlineJson) return null
    const offline = !queueJson && offlineJson ? JSON.parse(offlineJson) as { version?: number; queue?: unknown[]; index?: number; position?: number } : null
    if (offline && (offline.version !== 1 || !Number.isSafeInteger(offline.index) || offline.index! < 0 ||
      !Number.isSafeInteger(offline.position) || offline.position! < 0)) return null
    const raw = queueJson ? JSON.parse(queueJson) as unknown[] : offline?.queue
    if (!Array.isArray(raw) || raw.length === 0) return null

    const playlist: Song[] = []
    for (const item of raw) {
      const result = songSchema.safeParse(item)
      if (result.success) {
        const identity = parseCachedIdentity((item as { device_cache?: unknown })?.device_cache, result.data)
        if (item && typeof item === 'object' && 'device_cache' in item && !identity) continue
        playlist.push(identity ? snapshotCachedSong(result.data, identity) : result.data)
      }
    }
    if (playlist.length === 0) return null

    const currentIndex = Math.min(
      Math.max(0, indexStr != null ? parseInt(indexStr, 10) || 0 : offline?.index ?? 0),
      playlist.length - 1,
    )
    // New offline saves share the small progress keys; version-1 envelopes from
    // older bundles still supply the fallback, and contain no remote URLs.
    const positionMs = Math.max(0, posStr != null ? parseInt(posStr, 10) || 0 : offline?.position ?? 0)
    // Falls back to the legacy playlist-only key for one upgrade.
    const context = offline ? undefined : parseSavedContext(contextJson)
      ?? playlistContext(playlistIdStr ? parseInt(playlistIdStr, 10) || 0 : 0)

    return { playlist, currentIndex, positionMs, context, sourcePlaylistId: playlistIdOf(context) }
  } catch {
    return null
  }
}

/**
 * Params for {@link savePlaybackState}. Object-shaped per the API conventions
 * (`docs/reference/api-conventions.md`): four arguments, one of them optional,
 * is past the positional-argument threshold.
 */
export interface SavePlaybackStateParams {
  playlist: Song[]
  currentIndex: number
  positionMs: number
  context?: PlaybackContext
}

export function savePlaybackState(params: SavePlaybackStateParams): Promise<void> {
  writes = writes.catch(() => {}).then(() => writePlaybackState(params))
  return writes
}

async function encodeQueue(playlist: readonly Song[]): Promise<{ json: string, offline: boolean }> {
  const chunks: string[] = []
  let offline = false
  for (let start = 0; start < playlist.length; start += 256) {
    const batch = playlist.slice(start, start + 256).map(song => {
      const identity = cachedSongIdentity(song)
      if (!identity) return songToJson(song)
      offline = true
      return { ...songToJson(snapshotCachedSong(song, identity)), device_cache: identity }
    })
    chunks.push(JSON.stringify(batch).slice(1, -1))
    // Yield to input, progress and store updates while preparing a large queue.
    if (start + 256 < playlist.length) await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
  return { json: `[${chunks.join(',')}]`, offline }
}

async function writePlaybackState(params: SavePlaybackStateParams): Promise<void> {
  const { playlist, currentIndex, positionMs, context } = params
  try {
    const storage = getSongloftStorage()
    if (playlist.length === 0) {
      savedQueue = null
      await Promise.all([
        storage.prefs.remove(PREF_PLAYBACK_QUEUE),
        storage.prefs.remove(PREF_OFFLINE_PLAYBACK_QUEUE),
        storage.prefs.remove(PREF_PLAYBACK_INDEX),
        storage.prefs.remove(PREF_PLAYBACK_POSITION),
        storage.prefs.remove(PREF_PLAYBACK_CONTEXT),
        storage.prefs.remove(PREF_PLAYBACK_SOURCE_PLAYLIST),
      ])
      return
    }
    let offline = savedQueue?.offline ?? false
    if (savedQueue?.playlist !== playlist || savedQueue.storage !== storage) {
      const encoded = await encodeQueue(playlist)
      offline = encoded.offline
      // Preserve the version-1 offline envelope for older bundles; current
      // progress lives separately so subsequent ticks only write small keys.
      await storage.prefs.set(offline ? PREF_OFFLINE_PLAYBACK_QUEUE : PREF_PLAYBACK_QUEUE,
        offline
          ? `{"version":1,"queue":${encoded.json},"index":${JSON.stringify(currentIndex)},"position":${JSON.stringify(Math.round(positionMs))}}`
          : encoded.json)
      await storage.prefs.remove(offline ? PREF_PLAYBACK_QUEUE : PREF_OFFLINE_PLAYBACK_QUEUE)
    }
    await Promise.all([
      storage.prefs.set(PREF_PLAYBACK_INDEX, String(currentIndex)),
      storage.prefs.set(PREF_PLAYBACK_POSITION, String(Math.round(positionMs))),
      !offline && context != null
        ? storage.prefs.set(PREF_PLAYBACK_CONTEXT, JSON.stringify(context))
        : storage.prefs.remove(PREF_PLAYBACK_CONTEXT),
      // The legacy key is never written again; drop whatever an older build left.
      storage.prefs.remove(PREF_PLAYBACK_SOURCE_PLAYLIST),
    ])
    savedQueue = { storage, playlist, offline }
  } catch {
    savedQueue = null // A partial/failed write must be retried in full.
    // best-effort
  }
}
