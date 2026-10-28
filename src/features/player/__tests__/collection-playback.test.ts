import { afterEach, expect, test, vi } from 'vitest'
import { parseSong } from '../../../models/song.js'

const actions = vi.hoisted(() => ({ append: vi.fn(async () => {}), next: vi.fn(async () => {}), shuffle: vi.fn(async () => {}), play: vi.fn(async () => true) }))
vi.mock('../../output/runtime.js', () => ({ createQueueAppender: (position: string) => position === 'next' ? actions.next : actions.append, prepareCollectionShuffle: actions.shuffle }))
vi.mock('../data/play-all.js', () => ({ playAllWithBackgroundFill: actions.play }))
const { chooseCollectionPlayback, selectCollectionPlayback, cancelCollectionPlayback, collectionPlayback } = await import('../data/collection-playback.js')
const songs = [1, 2, 3].map(id => parseSong({ id, title: String(id) }))
afterEach(() => { cancelCollectionPlayback(); vi.clearAllMocks() })

test('a play shortcut opens options without fetching or playing', async () => {
  const fetch = vi.fn(async () => ({ songs, total: 3 }))
  const pending = chooseCollectionPlayback(fetch)
  expect(fetch).not.toHaveBeenCalled()
  expect(actions.play).not.toHaveBeenCalled()
  cancelCollectionPlayback()
  await pending
})
test('queue and next read unloaded pages and never start playback', async () => {
  for (const action of ['end', 'next']) {
    const fetch = vi.fn(async (offset: number) => ({ songs: offset ? songs.slice(1) : songs.slice(0, 1), total: 3 }))
    const pending = chooseCollectionPlayback(fetch)
    await selectCollectionPlayback(action)
    expect(await pending).toBe(true)
    expect(action === 'next' ? actions.next : actions.append).toHaveBeenCalledWith(songs)
  }
  expect(actions.play).not.toHaveBeenCalled()
})
test('shuffle awaits mode setup and keeps the fast background-fill play path', async () => {
  const fetch = vi.fn(async () => ({ songs, total: 3 }))
  const pending = chooseCollectionPlayback(fetch, { type: 'playlist', key: '7' })
  await selectCollectionPlayback('shuffle')
  await pending
  expect(actions.shuffle).toHaveBeenCalledOnce()
  expect(actions.play).toHaveBeenCalledWith(fetch, { type: 'playlist', key: '7' })
  expect(actions.shuffle.mock.invocationCallOrder[0]).toBeLessThan(actions.play.mock.invocationCallOrder[0]!)
})


test('the chooser keeps the actual trigger anchor for its root-level popover', async () => {
  const anchor = { anchor: { left: 900, top: 52, width: 96, height: 44 }, viewport: { width: 1100, height: 800 } }
  const pending = chooseCollectionPlayback(async () => ({ songs, total: 3 }), undefined, anchor)
  expect(collectionPlayback.getState().request?.anchor).toBe(anchor)
  cancelCollectionPlayback()
  await pending
})
