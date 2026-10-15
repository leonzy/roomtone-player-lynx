import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockStorage = new Map<string, string>()
vi.mock('../../../core/storage/index.js', () => {
  const storage = {
    prefs: {
      get: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
      set: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return Promise.resolve() }),
      remove: vi.fn((key: string) => { mockStorage.delete(key); return Promise.resolve() }),
    },
    secure: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  }
  return { getSongloftStorage: () => storage }
})

import { getSongloftStorage } from '../../../core/storage/index.js'
import type { Song } from '../../../models/song.js'
import { clearSavedPlaybackState, loadPlaybackState, savePlaybackState } from '../data/playback-persistence.js'
import { cacheIdentity, cacheNamespace } from '../domain/cache-identity.js'
import { playlistContext } from '../domain/playback-context.js'

/** Parsed (camelCase) form of {@link SONG_JSON}, as the store holds it. */
const SONG: Song = {
  id: 1,
  type: 'local' as const,
  title: 'Test Song',
  artist: 'Artist',
  album: undefined,
  year: 0,
  genre: undefined,
  language: undefined,
  style: undefined,
  duration: 200,
  filePath: '/music/test.mp3',
  url: '/stream/1',
  coverUrl: undefined,
  lyricUrl: undefined,
  lyricRemoteUrl: undefined,
  fileSize: 5000,
  format: 'mp3',
  bitRate: 320,
  sampleRate: 44100,
  sourceUrl: undefined,
  sourceCoverUrl: undefined,
  isLive: false,
  isVideo: false,
  addedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const SONG_JSON = {
  id: 1,
  type: 'local',
  title: 'Test Song',
  artist: 'Artist',
  album: null,
  year: 0,
  genre: null,
  language: null,
  style: null,
  duration: 200,
  file_path: '/music/test.mp3',
  url: '/stream/1',
  cover_url: null,
  lyric_url: null,
  lyric_remote_url: null,
  file_size: 5000,
  format: 'mp3',
  bit_rate: 320,
  sample_rate: 44100,
  source_url: null,
  source_cover_url: null,
  is_live: false,
  is_video: false,
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('playback-persistence', () => {
  beforeEach(async () => {
    await clearSavedPlaybackState()
    mockStorage.clear()
    vi.clearAllMocks()
  })

  const queueWrites = (key = 'playback_queue') =>
    vi.mocked(getSongloftStorage().prefs.set).mock.calls.filter(([name]) => name === key)

  test('progress and index saves leave the unchanged queue untouched', async () => {
    const playlist = [SONG, { ...SONG, id: 2, title: 'Second' }]
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 0 })
    await savePlaybackState({ playlist, currentIndex: 1, positionMs: 12345 })
    expect(queueWrites()).toHaveLength(1)
    expect(await loadPlaybackState()).toMatchObject({ currentIndex: 1, positionMs: 12345 })
  })

  test('a changed queue is written again, including removal and metadata edits', async () => {
    const playlist = [SONG, { ...SONG, id: 2 }]
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 0 })
    await savePlaybackState({ playlist: [{ ...SONG, title: 'Edited' }], currentIndex: 0, positionMs: 1 })
    expect(queueWrites()).toHaveLength(2)
    expect((await loadPlaybackState())?.playlist.map(song => song.title)).toEqual(['Edited'])
  })

  test('clearing revokes the queue cache even if the same array is saved again', async () => {
    const playlist = [SONG]
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 0 })
    await clearSavedPlaybackState()
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 9 })
    expect(queueWrites()).toHaveLength(2)
    expect((await loadPlaybackState())?.positionMs).toBe(9)
  })

  test('a failed queue write is retried instead of cached as saved', async () => {
    const playlist = [SONG]
    vi.mocked(getSongloftStorage().prefs.set).mockRejectedValueOnce(new Error('disk full'))
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 0 })
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 20 })
    expect(queueWrites()).toHaveLength(2)
    expect((await loadPlaybackState())?.positionMs).toBe(20)
  })

  test('large saves yield to input tasks before finishing and retain the full queue', async () => {
    const playlist = Array.from({ length: 3000 }, (_, i) => ({ ...SONG, id: i + 1 }))
    let finished = false
    const save = savePlaybackState({ playlist, currentIndex: 1500, positionMs: 10 }).then(() => { finished = true })
    const finishedAtInput = await new Promise<boolean>(resolve => setTimeout(() => resolve(finished), 0))
    await save
    expect(finishedAtInput).toBe(false)
    expect((await loadPlaybackState())?.playlist).toHaveLength(3000)
  })

  test('offline progress uses small keys without rewriting its safe queue envelope', async () => {
    const namespace = cacheNamespace({ profile: 'one', server: 'http://server', username: 'alice' })
    const identity = cacheIdentity({ namespace, song: SONG, variant: { track: null, quality: 'original', normalize: false }, format: 'mp3' })
    const playlist = [{ ...SONG, deviceCache: identity }, { ...SONG, deviceCache: identity }]
    await savePlaybackState({ playlist, currentIndex: 0, positionMs: 0 })
    await savePlaybackState({ playlist, currentIndex: 1, positionMs: 456 })
    expect(queueWrites('device_cache_playback_queue_v1')).toHaveLength(1)
    expect(await loadPlaybackState()).toMatchObject({ currentIndex: 1, positionMs: 456 })
    expect(mockStorage.get('device_cache_playback_queue_v1')).not.toMatch(/secret|\/music|\/stream/)
    // Pre-upgrade envelopes did not have separate progress keys.
    mockStorage.delete('playback_index')
    mockStorage.delete('playback_position')
    expect(await loadPlaybackState()).toMatchObject({ currentIndex: 0, positionMs: 0 })
  })

  test('local queue round-trips its precise variant, strips remote URLs, and rejects corrupt local identity', async () => {
    const namespace = cacheNamespace({ profile: 'one', server: 'http://server', username: 'alice' })
    const identity = cacheIdentity({ namespace, song: SONG, variant: { track: 1, quality: '192', normalize: true }, format: 'm4a' })
    const local = { ...SONG, deviceCache: identity, url: 'http://server?access_token=secret', coverUrl: 'secret-cover', lyricUrl: 'secret-lyrics' }
    await savePlaybackState({ playlist: [local], currentIndex: 0, positionMs: 42 })
    expect(mockStorage.has('playback_queue')).toBe(false)
    expect(mockStorage.get('device_cache_playback_queue_v1')).not.toMatch(/secret|file:\/\/|\/music/)
    const saved = await loadPlaybackState()
    expect(saved?.playlist[0]).toMatchObject({ deviceCache: identity, format: 'm4a', isVideo: false })
    expect(saved?.playlist[0].url).toBeUndefined()
    const corrupt = JSON.parse(mockStorage.get('device_cache_playback_queue_v1')!); corrupt.queue[0].device_cache.namespace = 'another-user'
    mockStorage.set('device_cache_playback_queue_v1', JSON.stringify(corrupt))
    expect(await loadPlaybackState()).toBeNull()
  })
  test('queue revocation is ordered after an older pending save', async () => {
    const save = savePlaybackState({ playlist: [SONG], currentIndex: 0, positionMs: 0 })
    const clear = clearSavedPlaybackState()
    await Promise.all([save, clear])
    expect(mockStorage.has('playback_queue')).toBe(false)
    expect(await loadPlaybackState()).toBeNull()
  })

  test('returns null when no saved state', async () => {
    expect(await loadPlaybackState()).toBeNull()
  })

  test('round-trips save and load', async () => {
    await savePlaybackState({ playlist: [SONG], currentIndex: 0, positionMs: 15000, context: playlistContext(42) })

    const restored = await loadPlaybackState()
    expect(restored).not.toBeNull()
    expect(restored!.playlist).toHaveLength(1)
    expect(restored!.playlist[0].title).toBe('Test Song')
    expect(restored!.currentIndex).toBe(0)
    expect(restored!.positionMs).toBe(15000)
    expect(restored!.context).toEqual({ type: 'playlist', key: '42' })
    expect(restored!.sourcePlaylistId).toBe(42)
  })

  test('round-trips a facet context, including a key needing URL encoding', async () => {
    await savePlaybackState({ playlist: [SONG], currentIndex: 0, positionMs: 0, context: { type: 'artist', key: 'AC/DC & 周杰伦' } })

    const restored = await loadPlaybackState()
    expect(restored!.context).toEqual({ type: 'artist', key: 'AC/DC & 周杰伦' })
    // Facet contexts have no playlist ID — and must not surface NaN.
    expect(restored!.sourcePlaylistId).toBeUndefined()
  })

  test('falls back to the legacy playlist-only key written by older builds', async () => {
    mockStorage.set('playback_queue', JSON.stringify([SONG_JSON]))
    mockStorage.set('playback_source_playlist', '7')

    const restored = await loadPlaybackState()
    expect(restored!.context).toEqual({ type: 'playlist', key: '7' })
    expect(restored!.sourcePlaylistId).toBe(7)
  })

  test('a corrupt context pref loses the context, not the whole queue', async () => {
    mockStorage.set('playback_queue', JSON.stringify([SONG_JSON]))
    mockStorage.set('playback_context', '{not json')

    const restored = await loadPlaybackState()
    expect(restored).not.toBeNull()
    expect(restored!.playlist).toHaveLength(1)
    expect(restored!.context).toBeUndefined()
  })

  test('clears state when saving empty playlist', async () => {
    mockStorage.set('playback_queue', JSON.stringify([SONG_JSON]))
    mockStorage.set('playback_index', '0')

    await savePlaybackState({ playlist: [], currentIndex: 0, positionMs: 0 })

    expect(await loadPlaybackState()).toBeNull()
  })

  test('clamps index to valid range', async () => {
    mockStorage.set('playback_queue', JSON.stringify([SONG_JSON, SONG_JSON]))
    mockStorage.set('playback_index', '99')
    mockStorage.set('playback_position', '5000')

    const restored = await loadPlaybackState()
    expect(restored!.currentIndex).toBe(1)
  })
})
