import { beforeEach, expect, test } from 'vitest'
import { createMemoryStorage } from '../../../core/storage/memory-storage.js'
import { changeLyricsScreenAwake, loadLyricsScreenAwake, lyricsScreenAwake, PREF_LYRICS_KEEP_SCREEN_ON } from '../data/lyrics-screen-awake.js'

beforeEach(() => lyricsScreenAwake.setState({ enabled: false }))

test('off by default and restores the saved device-local choice', async () => {
  const storage = createMemoryStorage()
  await loadLyricsScreenAwake(storage)
  expect(lyricsScreenAwake.getState().enabled).toBe(false)
  await changeLyricsScreenAwake(true, storage)
  lyricsScreenAwake.setState({ enabled: false })
  await loadLyricsScreenAwake(storage)
  expect(lyricsScreenAwake.getState().enabled).toBe(true)
})

test('a late read cannot overwrite the user choice and rapid writes remain ordered', async () => {
  const storage = createMemoryStorage()
  let answer!: (value: string | null) => void
  const reading = new Promise<string | null>(resolve => { answer = resolve })
  storage.prefs.get = () => reading
  const loaded = loadLyricsScreenAwake(storage)
  await Promise.resolve()
  await Promise.all([changeLyricsScreenAwake(true, storage), changeLyricsScreenAwake(false, storage), changeLyricsScreenAwake(true, storage)])
  answer('false')
  await loaded
  expect(lyricsScreenAwake.getState().enabled).toBe(true)
  // Check actual storage rather than only the in-memory store.
  const actual = createMemoryStorage()
  await changeLyricsScreenAwake(true, actual)
  await changeLyricsScreenAwake(false, actual)
  expect(await actual.prefs.get(PREF_LYRICS_KEEP_SCREEN_ON)).toBe('false')
})
