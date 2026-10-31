import { afterEach, expect, test, vi } from 'vitest'
import { createQueryClient } from '../../../lib/query/index.js'
import { parseSong } from '../../../models/song.js'
import { patchSongMetadata, updatedSong } from '../../../models/song-metadata.js'

const output = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('../../output/runtime.js', () => ({ outputKey: () => ['roomtone', 'test', 'outputs'], updateOutputSong: output.update }))
const { publishSavedSong } = await import('../data/song-metadata.js')
afterEach(() => vi.clearAllMocks())

test('patches every matching duplicate while preserving queue fields and unrelated entities', () => {
  const old = parseSong({ id: 7, title: 'Old', type: 'local' })
  const saved = { ...old, title: 'Edited', artist: 'Artist', album: 'Album', coverUrl: '/cover.jpg', updatedAt: 'new' }
  const other = parseSong({ id: 8, title: 'Other' })
  const offline = { ...old, deviceCache: { key: 'immutable snapshot' } }
  const data = { id: 7, name: 'Playlist', type: 'local', pages: [{ items: [{ ...old, position: 3 }, old, other, offline] }], pageParams: [0] }
  const result = patchSongMetadata(data, saved) as typeof data
  expect(result.name).toBe('Playlist')
  expect(result.pages[0]!.items[0]).toMatchObject({ title: 'Edited', artist: 'Artist', position: 3 })
  expect(result.pages[0]!.items[1]).toMatchObject(saved)
  expect(result.pages[0]!.items[2]).toBe(other)
  expect(result.pages[0]!.items[3]).toBe(offline)
  expect(result.pageParams).toBe(data.pageParams)
  expect(updatedSong(saved, saved)).toBe(saved)
})

test('a stale pending list response cannot overwrite a just-saved song', async () => {
  const client = createQueryClient()
  const old = parseSong({ id: 7, title: 'Old' }), saved = { ...old, title: 'Edited' }
  const key = ['library', 'songs', 'all']
  client.setQueryData(key, { items: [old] })
  let finish!: (value: { items: typeof old[] }) => void
  const pending = client.fetchQuery({ queryKey: key, staleTime: 0,
    queryFn: () => new Promise<{ items: typeof old[] }>(resolve => { finish = resolve }) }).catch(() => undefined)
  await publishSavedSong(saved, client)
  finish({ items: [old] })
  await pending
  expect(client.getQueryData(key)).toMatchObject({ items: [{ title: 'Edited' }] })
  expect(output.update).toHaveBeenCalledExactlyOnceWith(saved)
  client.clear()
})
