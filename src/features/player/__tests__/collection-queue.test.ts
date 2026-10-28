import { expect, test, vi } from 'vitest'
import { collectQueueSongs } from '../data/collection-queue.js'
import { parseSong } from '../../../models/song.js'

test('queue all includes unloaded pages in displayed order', async () => {
  const songs = [1, 2, 3, 4].map(id => parseSong({ id, title: String(id) }))
  const fetch = vi.fn(async (offset: number) => songs.slice(offset))
  expect(await collectQueueSongs(songs.slice(0, 2), 4, fetch)).toEqual(songs)
  expect(fetch).toHaveBeenCalledWith(2, 2)
})
test('a selection needs no further source fetching', async () => {
  const selected = [parseSong({ id: 3, title: 'Selected' })], fetch = vi.fn()
  expect(await collectQueueSongs(selected, selected.length, fetch)).toEqual(selected)
  expect(fetch).not.toHaveBeenCalled()
})
