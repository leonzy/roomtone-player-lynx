import { afterEach, expect, test, vi } from 'vitest'
import type { Song } from '../../../models/song.js'
import type { PlaybackContext } from '../domain/playback-context.js'

const { playAll, loadRemaining, state } = vi.hoisted(() => {
  const playAll = vi.fn(async (_songs: Song[], _context?: PlaybackContext) => {})
  const loadRemaining = vi.fn()
  return { playAll, loadRemaining, state: { playAll, loadRemainingSongsForCurrentPlaylist: loadRemaining } }
})
vi.mock('../store/index.js', () => ({ usePlayerStore: { getState: () => state } }))
const { replaceCollectionQueue } = await import('../data/play-all.js')
const songs = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i, title: String(from + i), type: 'local', duration: 1 } as Song))
afterEach(() => vi.clearAllMocks())

test('prepares every page before one complete replacement and never starts background fill', async () => {
  const all = songs(1, 350)
  let release!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const fetch = vi.fn(async (offset: number, limit: number) => {
    if (offset) await waiting
    return { songs: all.slice(offset, offset + limit), total: all.length }
  })
  const context = { type: 'playlist' as const, key: '42' }
  const pending = replaceCollectionQueue(fetch, context)
  for (let i = 0; i < 10; i++) await Promise.resolve()
  expect(playAll).not.toHaveBeenCalled()
  release()
  await expect(pending).resolves.toBe(true)
  expect(fetch.mock.calls).toEqual([[0, 200], [200, 150]])
  expect(playAll).toHaveBeenCalledExactlyOnceWith(all, context)
  expect(loadRemaining).not.toHaveBeenCalled()
})

test('uses loaded pages only as preparation, not as an interim queue', async () => {
  const first = songs(1, 2), rest = songs(3, 2)
  const fetch = vi.fn(async () => ({ songs: rest, total: 4 }))
  await replaceCollectionQueue(fetch, undefined, { songs: first, total: 4 })
  expect(fetch).toHaveBeenCalledExactlyOnceWith(2, 2)
  expect(playAll).toHaveBeenCalledExactlyOnceWith([...first, ...rest], undefined)
  expect(loadRemaining).not.toHaveBeenCalled()
})

test('empty collections leave playback untouched', async () => {
  await expect(replaceCollectionQueue(async () => ({ songs: [], total: 0 }))).resolves.toBe(false)
  expect(playAll).not.toHaveBeenCalled()
})

test('failed or incomplete preparation never changes the active queue', async () => {
  await expect(replaceCollectionQueue(async () => { throw new Error('network down') })).rejects.toThrow('network down')
  await expect(replaceCollectionQueue(async () => { throw new Error('page failed') }, undefined, { songs: songs(1, 1), total: 2 })).rejects.toThrow('page failed')
  await expect(replaceCollectionQueue(async () => ({ songs: [], total: 2 }), undefined, { songs: songs(1, 1), total: 2 })).rejects.toThrow('未替换播放队列')
  expect(playAll).not.toHaveBeenCalled()
  expect(loadRemaining).not.toHaveBeenCalled()
})

test('an older preparation cannot replace a subsequently chosen collection', async () => {
  let release!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const old = replaceCollectionQueue(async () => { await waiting; return { songs: songs(1, 1), total: 1 } })
  await replaceCollectionQueue(async () => ({ songs: songs(20, 1), total: 1 }))
  release()
  await old
  expect(playAll).toHaveBeenCalledExactlyOnceWith(songs(20, 1), undefined)
})

test('playback errors propagate without starting a background loader', async () => {
  playAll.mockRejectedValueOnce(new Error('play failed'))
  await expect(replaceCollectionQueue(async () => ({ songs: songs(1, 3), total: 3 }))).rejects.toThrow('play failed')
  expect(loadRemaining).not.toHaveBeenCalled()
})
