import { expect, test, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { parseSong, type Song } from '../../../models/song.js'
import { followPlayerLyrics } from '../data/follow-player-lyrics.js'

test('a restored current song loads lyrics immediately without waiting for another song change', async () => {
  const song = parseSong({ id: 52622, title: '当我想你的时候', type: 'local' })
  const player = createStore<{ currentSong?: Song; currentTime: number }>(() => ({ currentSong: song, currentTime: 45000 }))
  const lyrics = { loadForSong: vi.fn(async () => {}), syncPosition: vi.fn() }
  const stop = followPlayerLyrics(player, lyrics, () => true)
  await Promise.resolve()
  expect(lyrics.loadForSong).toHaveBeenCalledExactlyOnceWith(song)
  expect(lyrics.syncPosition).toHaveBeenCalledExactlyOnceWith(45000)
  stop()
})

test('remote auto advance loads new lyrics and resets their position without changing local notifications', async () => {
  const first = parseSong({ id: 1, title: 'First' }), second = parseSong({ id: 2, title: 'Second' })
  const player = createStore<{ currentSong?: Song; currentTime: number }>(() => ({ currentSong: first, currentTime: 78000 }))
  const lyrics = { loadForSong: vi.fn(async () => {}), syncPosition: vi.fn() }
  const stop = followPlayerLyrics(player, lyrics, () => false)
  player.setState({ currentSong: second, currentTime: 0 })
  await Promise.resolve()
  expect(lyrics.loadForSong).toHaveBeenCalledWith(second)
  expect(lyrics.syncPosition).toHaveBeenLastCalledWith(0, false)
  player.setState({ currentTime: 12000 })
  expect(lyrics.syncPosition).toHaveBeenLastCalledWith(12000, false)
  stop()
})

test('late lyric loads cannot resynchronize the previous track', async () => {
  const songs = [1, 2].map(id => parseSong({ id, title: String(id) }))
  const player = createStore<{ currentSong?: Song; currentTime: number }>(() => ({ currentTime: 0 }))
  const pending: Array<() => void> = []
  const lyrics = { loadForSong: vi.fn(() => new Promise<void>(resolve => pending.push(resolve))), syncPosition: vi.fn() }
  const stop = followPlayerLyrics(player, lyrics, () => true)
  player.setState({ currentSong: songs[0], currentTime: 10000 })
  player.setState({ currentSong: songs[1], currentTime: 2000 })
  pending[0]!(); await Promise.resolve()
  expect(lyrics.syncPosition).not.toHaveBeenCalled()
  pending[1]!(); await Promise.resolve()
  expect(lyrics.syncPosition).toHaveBeenCalledExactlyOnceWith(2000)
  stop()
})
