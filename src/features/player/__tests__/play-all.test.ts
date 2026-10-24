import { afterEach, describe, expect, test, vi } from 'vitest'

import type { Song } from '../../../models/song.js'
import type { PlaybackContext } from '../domain/playback-context.js'

/**
 * `playAllWithBackgroundFill` is the "play all" entry shared by home, playlist,
 * tag, facet and folder grids. It must not serialize the whole source before
 * the first note: only the first page blocks, the rest goes to the store's
 * background loader (Flutter `playPlaylistById` parity).
 */

const { playAll, loadRemaining, state } = vi.hoisted(() => {
  const playAll = vi.fn(async (_songs: Song[], _context?: PlaybackContext) => {})
  const loadRemaining = vi.fn()
  return {
    playAll,
    loadRemaining,
    state: { playAll, loadRemainingSongsForCurrentPlaylist: loadRemaining },
  }
})

vi.mock('../store/index.js', () => ({
  usePlayerStore: { getState: () => state },
}))

const { PLAY_ALL_FIRST_PAGE, playAllWithBackgroundFill } = await import('../data/play-all.js')

function song(id: number): Song {
  return { id, type: 'local', title: `Song ${id}`, duration: 1 } as Song
}

function songs(from: number, count: number): Song[] {
  return Array.from({ length: count }, (_, i) => song(from + i))
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('playAllWithBackgroundFill', () => {
  test('starts on the first page and streams the remainder through the loader', async () => {
    const all = songs(0, 35)
    const fetchPage = vi.fn(async (offset: number, limit: number) => ({
      songs: all.slice(offset, offset + limit),
      total: all.length,
    }))
    const context = { type: 'playlist' as const, key: '42' }

    await expect(playAllWithBackgroundFill(fetchPage, context)).resolves.toBe(true)

    expect(PLAY_ALL_FIRST_PAGE).toBe(10)
    expect(fetchPage.mock.calls).toEqual([[0, PLAY_ALL_FIRST_PAGE]])
    expect(playAll).toHaveBeenCalledTimes(1)
    expect(playAll.mock.calls[0]![0].map((s: Song) => s.id)).toEqual(songs(0, 10).map(s => s.id))
    expect(playAll.mock.calls[0]![1]).toBe(context)

    const fill = loadRemaining.mock.calls[0]![0] as {
      loadedCount: number
      total: number
      fetch: (offset: number, limit: number) => Promise<Song[]>
    }
    expect(fill.loadedCount).toBe(10)
    expect(fill.total).toBe(35)

    const rest = await fill.fetch(10, 100)
    expect(rest.map(s => s.id)).toEqual(songs(10, 25).map(s => s.id))
    expect(fetchPage.mock.calls[1]).toEqual([10, 100])
  })

  test('reports an empty source without touching playback or the loader', async () => {
    const fetchPage = vi.fn(async () => ({ songs: [] as Song[], total: 0 }))

    await expect(playAllWithBackgroundFill(fetchPage)).resolves.toBe(false)

    expect(playAll).not.toHaveBeenCalled()
    expect(loadRemaining).not.toHaveBeenCalled()
  })

  test('propagates first-page failures to the caller', async () => {
    const fetchPage = vi.fn(async (): Promise<{ songs: Song[]; total: number }> => {
      throw new Error('network down')
    })

    await expect(playAllWithBackgroundFill(fetchPage)).rejects.toThrow('network down')

    expect(playAll).not.toHaveBeenCalled()
    expect(loadRemaining).not.toHaveBeenCalled()
  })

  test('propagates playback failures after scheduling the background fill', async () => {
    playAll.mockRejectedValueOnce(new Error('play failed'))
    const fetchPage = vi.fn(async () => ({ songs: songs(0, 3), total: 3 }))

    await expect(playAllWithBackgroundFill(fetchPage)).rejects.toThrow('play failed')

    expect(loadRemaining).toHaveBeenCalledTimes(1)
  })
})
