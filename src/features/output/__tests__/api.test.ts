import { expect, test, vi } from 'vitest'
import { OutputApi } from '../api.js'

test('fresh server devices with null EQ bands do not discard every playback zone', async () => {
  const api = new OutputApi()
  vi.spyOn(api, 'request').mockImplementation(async path => (path === '/players'
    ? [{ ID: 'raop:fresh', Name: 'New speaker', Kind: 'raop', Online: true, EQ: { enabled: false, bands: null, preset: '', preamp: 0 } }]
    : [{ id: 'zone', name: 'New speaker', master_id: 'raop:fresh', members: [{ player_id: 'raop:fresh' }], status: { queue: { items: null } } }]) as never)
  const outputs = await api.outputs()
  expect(outputs.players[0]?.EQ.bands).toEqual(Array(10).fill(0))
  expect(outputs.groups[0]?.status.queue.items).toEqual([])
  expect(outputs.groups[0]?.name).toBe('New speaker')
})

test('EQ save returns the normalized server profile rather than the submitted preamp', async () => {
  const api = new OutputApi()
  vi.spyOn(api, 'request').mockResolvedValue({ enabled: true, bands: Array(10).fill(6), preamp: -6, preset: '' })
  const saved = await api.setEq('raop:a', { enabled: true, bands: Array(10).fill(6), preamp: 0, preset: '' })
  expect(saved.preamp).toBe(-6)
})

test('output parsing retains standby state used by grouping and device settings', async () => {
  const api = new OutputApi()
  vi.spyOn(api, 'request').mockImplementation(async path => path === '/players' ? [{ ID: 'a', Name: 'A', Kind: 'raop', Online: true, standby: true }] : [] as never)
  expect((await api.outputs()).players[0]?.standby).toBe(true)
})

test('large queues use bounded batches and preserve repeated entries in queue order', async () => {
  const api = new OutputApi()
  const request = vi.spyOn(api, 'request').mockImplementation(async path => {
    const ids = path.split('ids=')[1]!.split(',').map(Number)
    expect(ids.length).toBeLessThanOrEqual(200)
    return { songs: ids.reverse().map(id => ({ id, title: String(id) })) } as never
  })
  const ids = [...Array.from({ length: 601 }, (_, i) => i + 1), 2, 1]
  expect((await api.songs(ids)).map(s => s.id)).toEqual(ids)
  expect(request).toHaveBeenCalledTimes(4)
})
test('missing queue songs are reported instead of moving the playing index', async () => {
  const api = new OutputApi()
  vi.spyOn(api, 'request').mockResolvedValue({ songs: [{ id: 1, title: 'one' }] })
  await expect(api.songs([1, 2, 1])).rejects.toThrow('Queue contains unavailable songs')
})
