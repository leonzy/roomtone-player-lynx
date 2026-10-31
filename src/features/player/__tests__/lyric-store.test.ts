import { describe, test, expect, vi, beforeEach } from 'vitest'

// The store reads/writes the lyric cache through `getSongloftStorage`; swap it
// for a per-test in-memory map so cached-vs-fetched paths are observable.
const mockStorage = new Map<string, string>()
vi.mock('../../../core/storage/index.js', () => ({
  getSongloftStorage: () => ({
    prefs: {
      get: (key: string) => Promise.resolve(mockStorage.get(key) ?? null),
      set: (key: string, value: string) => {
        mockStorage.set(key, value)
        return Promise.resolve()
      },
      remove: (key: string) => {
        mockStorage.delete(key)
        return Promise.resolve()
      },
    },
    secure: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  }),
}))

// `refetch` resolves the production fetcher at call time (no explicit fetcher
// is passed), so the default one is mocked here for the refetch tests.
// `vi.hoisted` because vi.mock factories run before any const initializes.
// The parameter list mirrors `LyricFetcher` (imported types are erased at
// compile time, so the hoisted callback may reference them).
const defaultFetcherMock = vi.hoisted(() =>
  vi.fn(async (
    _song: import('../../../models/song.js').Song,
    _opts?: { refresh?: boolean },
  ): Promise<{
    lyric?: string
    lxlyric?: string
    tlyric?: string
    rlyric?: string
  }> => ({})))
vi.mock('../data/lyric-source.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/lyric-source.js')>()
  return { ...actual, defaultLyricFetcher: defaultFetcherMock }
})

import type { Song } from '../../../models/song.js'
import type { LyricPayload } from '../../library/api/index.js'
import { useLyricStore } from '../store/lyric-store.js'
import { cacheIdentity, cacheNamespace } from '../domain/cache-identity.js'

function song(over: Partial<Song> = {}): Song {
  return {
    id: 7,
    type: 'local',
    title: 'Song',
    artist: 'Artist',
    album: undefined,
    year: 0,
    genre: undefined,
    language: undefined,
    style: undefined,
    duration: 200,
    filePath: '/music/a.mp3',
    url: '/stream/7',
    coverUrl: undefined,
    lyricUrl: '/api/v1/songs/7/lyric',
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
    ...over,
  }
}

const PAYLOAD: LyricPayload = {
  lyric: '[00:01.000]first\n[00:02.500]second\n',
}

beforeEach(() => {
  mockStorage.clear()
  defaultFetcherMock.mockReset()
  useLyricStore.getState().clear()
})

describe('loadForSong', () => {
  test('ordinary lyric payloads retain square word timing and text across cache loads', async () => {
    const fetcher = vi.fn(async () => ({ lyric: '[00:33.86]测[00:34.06]试[00:34.26]歌[00:34.46]词[00:34.71]' }))
    await useLyricStore.getState().loadForSong(song(), fetcher)
    expect(useLyricStore.getState().lyrics).toHaveLength(1)
    expect(useLyricStore.getState().lyrics[0].text).toBe('测试歌词')
    expect(useLyricStore.getState().lyrics[0].words).toHaveLength(4)
    useLyricStore.getState().syncPosition(34000)
    expect(useLyricStore.getState().currentIndex).toBe(0)
    await useLyricStore.getState().loadForSong(song(), fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(useLyricStore.getState().lyrics[0].text).toBe('测试歌词')
  })
  test('preserves per-source failure details and clears them when switching songs', async () => {
    const detail = 'QQ音乐：业务错误码 2001；网易云：未找到匹配；LRCLIB：HTTP 503'
    await useLyricStore.getState().loadForSong(song(), async () => { throw Object.assign(new Error('歌词获取失败'), { detail }) })
    expect(useLyricStore.getState()).toMatchObject({ loadFailed: true, loadError: detail })
    await useLyricStore.getState().loadForSong(song({ id: 9 }), async () => PAYLOAD)
    expect(useLyricStore.getState().loadFailed).toBe(false)
    expect(useLyricStore.getState().loadError).toBeUndefined()
  })
  test('keeps notification lyric placement across loading, missing lyrics and failures', async () => {
    useLyricStore.getState().setNotificationLyricInTitle(false)
    await useLyricStore.getState().loadForSong(song(), async () => PAYLOAD)
    expect(useLyricStore.getState().notificationLyricInTitle).toBe(false)
    await useLyricStore.getState().loadForSong(song({ lyricUrl: undefined }))
    expect(useLyricStore.getState().notificationLyricInTitle).toBe(false)
    await useLyricStore.getState().loadForSong(song({ id: 8 }), async () => {
      throw new Error('fetch failed')
    })
    expect(useLyricStore.getState().notificationLyricInTitle).toBe(false)
    useLyricStore.getState().clear()
    expect(useLyricStore.getState().notificationLyricInTitle).toBe(false)
  })

  test('parses the fetched payload into synced lines', async () => {
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(song(), fetcher)

    const s = useLyricStore.getState()
    expect(s.lyrics).toHaveLength(2)
    expect(s.synced).toBe(true)
    expect(s.loadFailed).toBe(false)
    expect(s.rawLyric).toBe(PAYLOAD.lyric)
    expect(s.isLoading).toBe(false)
  })

  test('serves a cached payload without calling the fetcher', async () => {
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(song(), fetcher)

    const fetcher2 = vi.fn(async () => ({ lyric: '[00:09.000]other\n' }))
    await useLyricStore.getState().loadForSong(song(), fetcher2)

    expect(fetcher2).not.toHaveBeenCalled()
    expect(useLyricStore.getState().rawLyric).toBe(PAYLOAD.lyric)
  })

  test('forceRefresh bypasses the cache and forwards refresh to the fetcher', async () => {
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(song(), fetcher)

    const fresh: LyricPayload = { lyric: '[00:03.000]fresh\n' }
    const fetcher2 = vi.fn(async (
      _song: Song,
      _opts?: { refresh?: boolean },
    ) => fresh)
    await useLyricStore.getState().loadForSong(song(), fetcher2, { forceRefresh: true })

    expect(fetcher2).toHaveBeenCalledTimes(1)
    expect(fetcher2.mock.calls[0]![1]).toEqual({ refresh: true })
    expect(useLyricStore.getState().rawLyric).toBe(fresh.lyric)
  })

  test('invalidates cache when song.updatedAt changed (issue #477)', async () => {
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(song(), fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Same songId, but the server has since updated the song (embedded USLT rewrite).
    // The cached copy must be invalidated and the fetcher called again.
    const fresh: LyricPayload = { lyric: '[00:05.000]updated\n' }
    const fetcher2 = vi.fn(async () => fresh)
    await useLyricStore.getState().loadForSong(
      song({ updatedAt: '2026-09-21T12:00:00Z' }),
      fetcher2,
    )

    expect(fetcher2).toHaveBeenCalledTimes(1)
    expect(useLyricStore.getState().rawLyric).toBe(fresh.lyric)

    // And the newly written cache entry carries the new songUpdatedAt, so the
    // next load with the same updatedAt is a hit.
    const stored = JSON.parse(mockStorage.get('lyric_7') ?? '{}')
    expect(stored.songUpdatedAt).toBe('2026-09-21T12:00:00Z')
  })

  test('sets loadFailed when the fetch throws', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network down')
    })
    await useLyricStore.getState().loadForSong(song(), fetcher)

    expect(useLyricStore.getState().loadFailed).toBe(true)
    expect(useLyricStore.getState().lyrics).toHaveLength(0)
  })

  test('loads local lyrics automatically when a restored queue has no lyric URL', async () => {
    const fetcher = vi.fn(async (_song: Song) => PAYLOAD)
    await useLyricStore.getState().loadForSong(song({ lyricUrl: undefined }), fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[0]).toMatchObject({ lyricUrl: '/api/v1/songs/7/lyric' })
    expect(useLyricStore.getState().rawLyric).toBe(PAYLOAD.lyric)
  })

  test('shows the actual failure when a local queue lacks a lyric URL', async () => {
    await useLyricStore.getState().loadForSong(song({ lyricUrl: undefined }), async () => {
      throw Object.assign(new Error('歌词获取失败'), { detail: 'QQ音乐：请求超时；网易云：未找到匹配' })
    })
    expect(useLyricStore.getState().loadFailed).toBe(true)
    expect(useLyricStore.getState().loadError).toContain('QQ音乐：请求超时')
  })

  test('clears state for a remote song without a lyric URL', async () => {
    await useLyricStore.getState().loadForSong(song({ type: 'remote', lyricUrl: undefined }))
    expect(useLyricStore.getState().lyrics).toHaveLength(0)
  })

  test('never invents a network endpoint for device-cached offline songs', async () => {
    const local = song({ lyricUrl: undefined })
    const namespace = cacheNamespace({ profile: 'offline', server: 'https://example.com', username: 'alice' })
    const cached = Object.assign(local, { deviceCache: cacheIdentity({ namespace, song: local,
      variant: { track: null, quality: 'original', normalize: false }, format: 'mp3' }) })
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(cached, fetcher)
    await useLyricStore.getState().refetch(cached)
    expect(fetcher).not.toHaveBeenCalled()
    expect(defaultFetcherMock).not.toHaveBeenCalled()
  })
})

describe('refetch', () => {
  test('evicts the cache and reloads from the backend with refresh set', async () => {
    const fetcher = vi.fn(async () => PAYLOAD)
    await useLyricStore.getState().loadForSong(song(), fetcher)
    expect(mockStorage.has('lyric_7')).toBe(true)

    const fresh: LyricPayload = { lyric: '[00:04.000]re-fetched\n' }
    defaultFetcherMock.mockImplementation(async () => fresh)

    await useLyricStore.getState().refetch(song())

    // Old payload gone, fresh payload applied.
    expect(useLyricStore.getState().rawLyric).toBe(fresh.lyric)
    // The refresh flag reached the (default) fetcher.
    expect(defaultFetcherMock.mock.calls[0]![1]).toEqual({ refresh: true })
  })

  test('assembles the lyric endpoint for a local song without lyricUrl', async () => {
    const local = song({ lyricUrl: undefined })
    defaultFetcherMock.mockImplementation(async (_s, opts) => {
      expect(opts?.refresh).toBe(true)
      return PAYLOAD
    })

    await useLyricStore.getState().refetch(local)

    expect(defaultFetcherMock.mock.calls[0]![0]).toMatchObject({
      lyricUrl: '/api/v1/songs/7/lyric',
    })
    expect(useLyricStore.getState().rawLyric).toBe(PAYLOAD.lyric)
  })

  test('does nothing for a remote song without lyricUrl', async () => {
    await useLyricStore.getState().refetch(song({ type: 'remote', lyricUrl: undefined }))
    expect(useLyricStore.getState().lyrics).toHaveLength(0)
  })

  test('does nothing without a song', async () => {
    await expect(useLyricStore.getState().refetch(undefined)).resolves.toBeUndefined()
  })
})

describe('syncPosition', () => {
  test('tracks the current line by position (no offset state anymore)', async () => {
    await useLyricStore.getState().loadForSong(
      song(),
      vi.fn(async () => PAYLOAD),
    )

    useLyricStore.getState().syncPosition(1_200)
    expect(useLyricStore.getState().currentIndex).toBe(0)

    useLyricStore.getState().syncPosition(2_600)
    expect(useLyricStore.getState().currentIndex).toBe(1)
  })
})
