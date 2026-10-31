import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { getQueryClient } from '../../../lib/query/index.js'
import { createMemoryStorage, setSongloftStorage } from '../../../core/storage/index.js'
import { getSharedClient } from '../../../core/network/api-client.js'
import { parseSong } from '../../../models/song.js'
import { applySongMetadata } from '../../library/data/song-metadata.js'
import type { PlayerState } from '../../player/store/player-store.js'
import { outputApi, outputId, volumeInt, type Outputs } from '../api.js'
import { createQueueAppender, createCollectionAction, createZonePlayer, focusZone, outputKey, refreshOutputs, startOutputRuntime, useZoneState } from '../runtime.js'

const socket = vi.hoisted(() => ({ callbacks: null as null | { open(): void; message(data: Record<string, unknown>): void; close(): void }, send: vi.fn(), close: vi.fn() }))
vi.mock('../socket.js', () => ({ connectPlaybackSocket: async (_ticket: string, callbacks: typeof socket.callbacks) => { socket.callbacks = callbacks; return { send: socket.send, close: socket.close } } }))
const song = (id: number) => parseSong({ id, title: `Track ${id}`, duration: 200 })
const state = (items: number[], index = 0, status = 'paused') => ({ song_id: items[index] ?? 0, position: 20, state: status, queue: { items, current: index, repeat: 'off', shuffle: false }, underruns: 0 })
let outputs: Outputs
let engine: UseBoundStore<StoreApi<PlayerState>>
let player: UseBoundStore<StoreApi<PlayerState>>
let cleanup: (() => void) | undefined
beforeEach(async () => {
  vi.useFakeTimers()
  socket.send.mockClear(); socket.close.mockClear()
  const storage = createMemoryStorage(); setSongloftStorage(storage); await storage.prefs.set('roomtone.local-device-id', 'web')
  useZoneState.setState({ focus: null, deviceId: 'web', connected: false, panel: null, busy: false, error: '' })
  outputs = {
    players: [],
    groups: [
      { id: 'local', name: 'Web', icon: '', master_id: 'web', members: [{ player_id: 'web', delay_ms: 0, volume_offset: 0, position: 0 }], status: state([1, 2], 0, 'playing'), sync_tier: 'exact' },
      { id: 'remote', name: 'Speaker', icon: '', master_id: 'raop:a', members: [{ player_id: 'raop:a', delay_ms: 0, volume_offset: 0, position: 0 }], status: state([3, 4]), sync_tier: 'exact' },
    ],
  }
  vi.spyOn(outputApi, 'outputs').mockImplementation(async () => structuredClone(outputs))
  vi.spyOn(outputApi, 'songs').mockImplementation(async ids => ids.map(song))
  vi.spyOn(outputApi, 'getQueue').mockImplementation(async id => structuredClone(outputs.groups.find(g => g.id === id)!.status))
  vi.spyOn(outputApi, 'replaceQueue').mockImplementation(async (id, ids, index) => { const g = outputs.groups.find(g => g.id === id)!; g.status = state(ids, index); return g.status })
  vi.spyOn(outputApi, 'transport').mockImplementation(async (id, action) => { const s = outputs.groups.find(g => g.id === id)!.status; if (action === 'play') s.state = 'playing'; return s })
  engine = create<PlayerState>((set) => ({
    playlist: [song(1), song(2)], currentSong: song(1), currentIndex: 0, currentTime: 7000, duration: 200000,
    isPlaying: true, volume: 31, isBuffering: false, playMode: 'order', showPlaylistDrawer: false,
    playSong: vi.fn(async () => {}), playPlaylist: vi.fn(async () => {}), playAll: vi.fn(async () => {}),
    playNext: vi.fn(async () => {}), playPrev: vi.fn(async () => {}), togglePlay: vi.fn(async () => {}),
    seek: vi.fn(async () => {}), setVolume: vi.fn(async v => { set({ volume: Math.round(v) }) }),
    toggleMute: vi.fn(async () => {}), setPlayMode: vi.fn(), cancelPendingPlayback: vi.fn(),
    loadZoneQueue: vi.fn(async ({ songs, index, positionMs }) => { set({ playlist: songs, currentIndex: index, currentSong: songs[index], currentTime: positionMs, isPlaying: false }) }),
  } as unknown as PlayerState))
  player = createZonePlayer(engine)
  getQueryClient().setQueryData(outputKey(), outputs)
})
afterEach(() => { cleanup?.(); cleanup = undefined; getQueryClient().clear(); vi.restoreAllMocks(); vi.useRealTimers() })

test('metadata refresh patches library, local queue and remote zones without playback commands', async () => {
  const second = engine.getState().playlist[1]
  const original = engine.getState().currentSong!
  const client = getQueryClient()
  client.setQueryData(['library', 'songs', 'all'], { pages: [{ items: [original, second], total: 2 }], pageParams: [0] })
  client.setQueryData(['playlist', 'songs', 1], { items: [original] })
  client.setQueryData(['song-tags', 1, 'songs'], { pages: [{ songs: [original] }] })
  client.setQueryData(['play-history'], [{ song: original, playCount: 3 }])
  await focusZone('remote')
  const localSaved = { ...original, title: 'Edited title', artist: 'Edited artist', album: 'Edited album', coverUrl: '/new.jpg', updatedAt: 'new' }
  applySongMetadata(localSaved)
  expect(engine.getState().currentSong).toMatchObject(localSaved)
  expect(engine.getState()).toMatchObject({ currentTime: 7000, isPlaying: true, currentIndex: 0 })
  expect(engine.getState().playlist[1]).toBe(second)
  expect(client.getQueryData(['library', 'songs', 'all'])).toMatchObject({ pages: [{ items: [{ title: 'Edited title' }, { id: 2 }] }] })
  expect(client.getQueryData(['playlist', 'songs', 1])).toMatchObject({ items: [{ artist: 'Edited artist' }] })
  expect(client.getQueryData(['song-tags', 1, 'songs'])).toMatchObject({ pages: [{ songs: [{ album: 'Edited album' }] }] })
  expect(client.getQueryData(['play-history'])).toMatchObject([{ song: { title: 'Edited title' }, playCount: 3 }])
  const remoteSaved = { ...song(3), title: 'Edited speaker title', updatedAt: 'new' }
  applySongMetadata(remoteSaved)
  expect(player.getState().currentSong?.title).toBe(remoteSaved.title)
  expect(player.getState()).toMatchObject({ currentTime: 20000, isPlaying: false })
  await refreshOutputs()
  expect(player.getState().currentSong?.title).toBe(remoteSaved.title)
  await focusZone('local')
  expect(player.getState().currentSong?.title).toBe(localSaved.title)
  expect(outputApi.transport).not.toHaveBeenCalled()
  expect(outputApi.replaceQueue).not.toHaveBeenCalled()
  expect(engine.getState().loadZoneQueue).not.toHaveBeenCalled()
})

test('startup refreshes persisted current-song metadata without losing playback progress', async () => {
  engine.setState({ currentSong: { ...song(1), title: 'Old persisted title' } })
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime()
  await Promise.resolve(); await Promise.resolve()
  expect(engine.getState().currentSong?.title).toBe('Track 1')
  expect(engine.getState()).toMatchObject({ currentTime: 7000, isPlaying: true, currentIndex: 0 })
  expect(engine.getState().loadZoneQueue).not.toHaveBeenCalled()
  expect(outputApi.transport).not.toHaveBeenCalled()
})

test('successive queue snapshots do not retain every previous full queue', async () => {
  await focusZone('remote')
  for (let n = 0; n < 100; n++) {
    outputs.groups[1]!.status = state(Array.from({ length: 700 }, (_, i) => n + i + 3))
    await refreshOutputs()
  }
  const snapshots = getQueryClient().getQueryCache().findAll({ queryKey: [...outputKey(), 'songs'] })
  expect(snapshots).toHaveLength(1)
  expect(player.getState().currentSong?.id).toBe(102)
})

test('an hour of Web progress ticks does not repeatedly serialize an unchanged large queue', async () => {
  const queue = Array.from({ length: 700 }, (_, i) => song(i + 1))
  engine.setState({ playlist: queue, currentIndex: 0 })
  const map = vi.spyOn(queue, 'map')
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime()
  await Promise.resolve(); await Promise.resolve()
  socket.callbacks!.open()
  engine.setState({ currentTime: 250 })
  const startupPasses = map.mock.calls.length
  for (let tick = 2; tick <= 14_400; tick++) engine.setState({ currentTime: tick * 250 })
  expect(startupPasses).toBeLessThanOrEqual(3) // one bounded metadata refresh plus initial queue synchronization
  expect(map.mock.calls.length).toBe(startupPasses)
})

test('remote focus projects its queue without pausing or replacing local playback', async () => {
  await focusZone('remote')
  expect(player.getState().currentSong?.id).toBe(3)
  expect(player.getState().playlist.map(s => s.id)).toEqual([3, 4])
  expect(engine.getState().currentSong?.id).toBe(1)
  expect(engine.getState().isPlaying).toBe(true)
  await player.getState().playPlaylist([song(9), song(10)], 1)
  expect(outputApi.replaceQueue).toHaveBeenLastCalledWith('remote', [9, 10], 1)
  expect(engine.getState().playPlaylist).not.toHaveBeenCalled()
  await focusZone('local')
  expect(player.getState().currentSong?.id).toBe(1)
  expect(player.getState().currentTime).toBe(7000)
})
test('remote seek uses seconds and volume never changes the local audio volume', async () => {
  vi.spyOn(outputApi, 'groupVolume').mockResolvedValue({})
  await focusZone('remote')
  await player.getState().seek(12345)
  expect(outputApi.transport).toHaveBeenLastCalledWith('remote', 'seek', { position: 12.345 })
  await player.getState().setVolume(16)
  expect(outputApi.groupVolume).toHaveBeenCalledWith('remote', 16)
  expect(engine.getState().setVolume).not.toHaveBeenCalled()
})
test('switching focus while queue fetch is pending rejects the stale projection', async () => {
  let resolve!: (v: ReturnType<typeof song>[]) => void
  vi.mocked(outputApi.songs).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const pending = focusZone('remote')
  await Promise.resolve()
  await focusZone('local')
  resolve([song(3), song(4)])
  await pending
  expect(player.getState().currentSong?.id).toBe(1)
})
test('empty remote queue clears only its projection; duplicate queue entries remain distinct', async () => {
  vi.spyOn(outputApi, 'request').mockResolvedValue({})
  outputs.groups[1]!.status = state([], -1)
  await refreshOutputs(); await focusZone('remote')
  expect(player.getState().playlist).toEqual([])
  expect(engine.getState().isPlaying).toBe(true)
  await player.getState().playPlaylist([song(3), song(3), song(4)], 1)
  await player.getState().removeFromPlaylist(0).catch(() => {})
  expect(outputApi.replaceQueue).toHaveBeenCalledWith('remote', [3, 3, 4], 1)
})
test('server load takes complete local queue even while UI controls a remote speaker', async () => {
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime()
  await Promise.resolve(); await Promise.resolve()
  socket.callbacks!.open()
  await focusZone('remote')
  socket.callbacks!.message({ cmd: 'load', song_id: 1, position_ms: 45000 })
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(engine.getState().loadZoneQueue).toHaveBeenCalledWith({ songs: [song(1), song(2)], index: 0, positionMs: 45000 })
  expect(player.getState().currentSong?.id).toBe(3)
  expect(socket.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'register_player', id: 'web' }))
})
test('stop during a pending queue load prevents a late load or scheduled play', async () => {
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime(); await Promise.resolve(); await Promise.resolve()
  let resolve!: (value: ReturnType<typeof song>[]) => void
  vi.mocked(outputApi.songs).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  socket.callbacks!.message({ cmd: 'load', song_id: 1 })
  for (let i = 0; i < 30; i++) await Promise.resolve()
  socket.callbacks!.message({ cmd: 'stop' })
  resolve([song(1), song(2)])
  for (let i = 0; i < 12; i++) await Promise.resolve()
  expect(engine.getState().loadZoneQueue).not.toHaveBeenCalled()
})
test('stable RAOP identifiers preserve route colons and volume is integer bounded', () => {
  expect(outputId('raop:00:22:6c:30:9e:c4')).toBe('raop:00:22:6c:30:9e:c4')
  expect(volumeInt(10.589)).toBe(11); expect(volumeInt(120)).toBe(100); expect(volumeInt(NaN)).toBe(0)
})

test('pending transfer adoption does not report an old or zero position to the server', async () => {
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime(); await Promise.resolve(); await Promise.resolve()
  socket.callbacks!.open()
  let finish!: (value: ReturnType<typeof song>[]) => void
  vi.mocked(outputApi.songs).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  socket.callbacks!.message({ cmd: 'load', song_id: 1, position_ms: 78000 })
  await Promise.resolve(); await Promise.resolve()
  socket.send.mockClear()
  await vi.advanceTimersByTimeAsync(500)
  expect(socket.send.mock.calls.filter(([v]) => v.type === 'report')).toHaveLength(0)
  finish([song(1), song(2)])
  for (let i = 0; i < 16; i++) await Promise.resolve()
  await vi.advanceTimersByTimeAsync(500)
  expect(socket.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'report', position_ms: 78000 }))
})

test('local user playback supersedes an in-flight server load', async () => {
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime(); await Promise.resolve(); await Promise.resolve()
  let resolve!: (value: ReturnType<typeof song>[]) => void
  vi.mocked(outputApi.songs).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  socket.callbacks!.message({ cmd: 'load', song_id: 1 })
  for (let i = 0; i < 30; i++) await Promise.resolve()
  await player.getState().playSong(song(9))
  resolve([song(1), song(2)])
  for (let i = 0; i < 12; i++) await Promise.resolve()
  expect(engine.getState().playSong).toHaveBeenCalledWith(song(9), undefined)
  expect(engine.getState().loadZoneQueue).not.toHaveBeenCalled()
})


test('remote reorder uses atomic move and never replaces the active queue', async () => {
  vi.spyOn(outputApi, 'request').mockResolvedValue({})
  await focusZone('remote')
  vi.mocked(outputApi.replaceQueue).mockClear()
  player.getState().reorderPlaylist(0, 2)
  await vi.waitFor(() => expect(outputApi.request).toHaveBeenCalledWith('/groups/remote/queue/reorder', 'PUT', { from: 0, to: 1 }))
  expect(outputApi.replaceQueue).not.toHaveBeenCalled()
  expect(outputApi.transport).not.toHaveBeenCalled()
  await vi.waitFor(() => expect(useZoneState.getState().busy).toBe(false))
})

test('remote mode controls send repeat and shuffle without starting playback', async () => {
  await focusZone('remote')
  for (const [mode, repeat, shuffle] of [['order', 'off', false], ['loop', 'all', false], ['single', 'one', false], ['random', 'off', true]] as const) {
    player.getState().setPlayMode(mode)
    await vi.waitFor(() => expect(outputApi.transport).toHaveBeenLastCalledWith('remote', '', { repeat, shuffle }))
    await vi.waitFor(() => expect(useZoneState.getState().busy).toBe(false))
  }
  expect(engine.getState().setPlayMode).not.toHaveBeenCalled()
})


test('clearing captures the original zone even if focus changes while stop is pending', async () => {
  await focusZone('remote')
  let finish!: () => void
  vi.mocked(outputApi.transport).mockImplementationOnce(async () => { await new Promise<void>(resolve => { finish = resolve }); return outputs.groups[1]!.status })
  player.getState().clearPlaylist()
  await focusZone('local')
  finish()
  await vi.waitFor(() => expect(outputApi.replaceQueue).toHaveBeenCalledWith('remote', [], -1))
  await vi.waitFor(() => expect(useZoneState.getState().busy).toBe(false))
})


test('append preserves its captured remote target and never replaces or plays the queue', async () => {
  const request = vi.spyOn(outputApi, 'request').mockResolvedValue({})
  await focusZone('remote')
  const append = createQueueAppender('end')
  await focusZone('local')
  await append([song(8), song(9)])
  expect(request).toHaveBeenCalledWith('/groups/remote/queue', 'POST', { song_ids: [8, 9], position: 'end' })
  expect(outputApi.replaceQueue).not.toHaveBeenCalled()
  expect(outputApi.transport).not.toHaveBeenCalled()
})

test('next inserts batched collections in reverse batch order to preserve song order', async () => {
  const request = vi.spyOn(outputApi, 'request').mockResolvedValue({})
  await focusZone('remote')
  await createQueueAppender('next')(Array.from({ length: 205 }, (_, i) => song(i + 10)))
  expect(request.mock.calls.map(call => (call[2] as { song_ids: number[] }).song_ids)).toEqual([
    [210, 211, 212, 213, 214], Array.from({ length: 200 }, (_, i) => i + 10),
  ])
  expect(outputApi.transport).not.toHaveBeenCalled()
})

test('shuffle configures remote mode before loading and starting its collection', async () => {
  await focusZone('remote')
  await createCollectionAction('shuffle')([song(8), song(9)])
  expect(outputApi.transport).toHaveBeenNthCalledWith(1, 'remote', '', { repeat: 'off', shuffle: true })
  expect(outputApi.transport).toHaveBeenNthCalledWith(2, 'remote', 'play')
  expect(vi.mocked(outputApi.transport).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(outputApi.replaceQueue).mock.invocationCallOrder[0]!)
})


test('remote play all replaces the selected zone queue, not appends to it', async () => {
  await focusZone('remote')
  await player.getState().playAll([song(8), song(9)])
  expect(outputApi.replaceQueue).toHaveBeenLastCalledWith('remote', [8, 9], 0)
  expect(outputApi.transport).toHaveBeenLastCalledWith('remote', 'play')
  expect(engine.getState().playAll).not.toHaveBeenCalled()
})

 test('hot join loads the new group instead of a deleted solo group', async () => {
  vi.spyOn(getSharedClient(), 'post').mockResolvedValue({ data: { ticket: 'one-use' } } as never)
  cleanup = await startOutputRuntime()
  await Promise.resolve(); await Promise.resolve()
  socket.callbacks!.open()
  outputs.groups = [outputs.groups[1]!]
  outputs.groups[0]!.members.push({ player_id: 'web', delay_ms: 0, volume_offset: 0, position: 1 })
  socket.callbacks!.message({ cmd: 'load', song_id: 3, position_ms: 45000 })
  for (let i = 0; i < 50; i++) await Promise.resolve()
  expect(outputApi.getQueue).toHaveBeenLastCalledWith('remote')
  expect(engine.getState().loadZoneQueue).toHaveBeenCalledWith({ songs: [song(3), song(4)], index: 0, positionMs: 45000 })
 })
