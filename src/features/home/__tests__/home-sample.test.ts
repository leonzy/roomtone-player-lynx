import { expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ options: vi.fn((value: Record<string, unknown>) => value), get: vi.fn(async () => ({ playlists: [], total: 0 })) }))
vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery: (options: Record<string, unknown>) => mocks.options(options) }))
vi.mock('../../playlist/api/index.js', () => ({ getPlaylistApi: () => ({ getPlaylists: mocks.get }) }))
import { useHomePlaylists } from '../data/home-query.js'
import { buildPlaylistsQuery } from '../../playlist/api/playlist-api.js'

test('home samples one bounded page, retains old cards and separates batches in cache', async () => {
  useHomePlaylists('normal', { limit: 500, batch: 2, avoidIds: [3, 4], excludeIds: [1] })
  const options = mocks.options.mock.calls.at(-1)![0] as unknown as { queryFn(): Promise<unknown>; getNextPageParam(): undefined; placeholderData<T>(value: T): T; queryKey: unknown[]; enabled: boolean }
  await options.queryFn()
  expect(mocks.get).toHaveBeenLastCalledWith({ type: 'normal', random: true, avoidIds: [3, 4], excludeIds: [1] }, { limit: 200, offset: 0 })
  expect(options.getNextPageParam()).toBeUndefined()
  const previous = { pages: [{ playlists: [{ id: 3 }], total: 5000 }] }
  expect(options.placeholderData(previous)).toBe(previous)
  useHomePlaylists('normal', { limit: 200, batch: 3, avoidIds: [3, 4], excludeIds: [1] })
  expect(mocks.options.mock.calls.at(-1)![0].queryKey).not.toEqual(options.queryKey)
  useHomePlaylists('radio', { enabled: false })
  expect(mocks.options.mock.calls.at(-1)![0].enabled).toBe(false)
})

test('sample filters reach the real playlist query encoder', () => {
  expect(buildPlaylistsQuery({ type: 'normal', random: true, avoidIds: [3, 4], excludeIds: [1] }, { limit: 12 })).toMatchObject({ type: 'normal', random: 'true', avoid_ids: '3,4', exclude_ids: '1', limit: 12 })
})
