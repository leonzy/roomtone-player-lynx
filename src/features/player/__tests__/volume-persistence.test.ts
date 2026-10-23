import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createMemoryStorage, setSongloftStorage } from '../../../core/storage/index.js'
import { getAudio } from '../../../native/index.js'
import type { AudioEvent } from '../../../native/audio-types.js'
import { coerceVolume, PREF_VOLUME, readVolume } from '../data/volume-prefs.js'
import {
  resetVolumePersistenceForTests,
  restoreVolume,
  usePlayerStore,
} from '../store/player-store.js'

const emit = (event: AudioEvent) =>
  (getAudio() as unknown as { emit: (event: AudioEvent) => void }).emit(event)

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

let storage = createMemoryStorage()

beforeEach(() => {
  vi.useFakeTimers()
  storage = createMemoryStorage()
  setSongloftStorage(storage)
  resetVolumePersistenceForTests()
  usePlayerStore.getState().reset()
})

afterEach(() => {
  resetVolumePersistenceForTests()
  usePlayerStore.getState().reset()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('coerceVolume', () => {
  test('accepts values inside the slider range and rounds them', () => {
    expect(coerceVolume('37')).toBe(37)
    expect(coerceVolume('37.6')).toBe(38)
    expect(coerceVolume('140')).toBe(100)
    expect(coerceVolume('-3')).toBe(0)
  })

  test('reads malformed or missing values as unset', () => {
    expect(coerceVolume(null)).toBeNull()
    expect(coerceVolume('')).toBeNull()
    expect(coerceVolume('loud')).toBeNull()
  })
})

describe('volume persistence', () => {
  test('setVolume persists after the debounce and restoreVolume applies it', async () => {
    await usePlayerStore.getState().setVolume(37)
    // Still coalescing a slider drag — nothing written yet.
    expect(await storage.prefs.get(PREF_VOLUME)).toBeNull()

    vi.advanceTimersByTime(400)
    await flush()
    expect(await storage.prefs.get(PREF_VOLUME)).toBe('37')

    // A reset (logout / server switch) restores the default in memory but must
    // not overwrite the user's preference.
    usePlayerStore.getState().reset()
    resetVolumePersistenceForTests()
    expect(usePlayerStore.getState().volume).toBe(50)

    const setVolumeSpy = vi.spyOn(getAudio(), 'setVolume')
    await restoreVolume()
    expect(usePlayerStore.getState().volume).toBe(37)
    expect(setVolumeSpy).toHaveBeenCalledWith(0.37)
    expect(await storage.prefs.get(PREF_VOLUME)).toBe('37')
  })

  test('a startup volumeChanged event cannot overwrite the saved preference', async () => {
    await storage.prefs.set(PREF_VOLUME, '64')
    const restoring = restoreVolume()
    // A native host reporting its own default (e.g. iOS AVPlayer at 1.0).
    emit({ type: 'volumeChanged', volume: 100 })
    await restoring
    expect(usePlayerStore.getState().volume).toBe(64)
  })

  test('hardware volume changes are adopted and persisted once restored', async () => {
    await restoreVolume()
    emit({ type: 'volumeChanged', volume: 21 })
    expect(usePlayerStore.getState().volume).toBe(21)

    vi.advanceTimersByTime(400)
    await flush()
    expect(await readVolume(storage)).toBe(21)
  })

  /*
   * Android's volume *is* the OS media stream: the system persists it and the
   * hardware keys change it. Re-applying a remembered app value on launch would
   * undo a change the user made outside the app, so `restoreVolume` asks the
   * host instead (Flutter's mobile build does the same).
   */
  test('Android adopts the system stream volume instead of the saved preference', async () => {
    ;(globalThis as Record<string, unknown>).SystemInfo = { platform: 'Android' }
    try {
      await storage.prefs.set(PREF_VOLUME, '12')
      const setVolumeSpy = vi.spyOn(getAudio(), 'setVolume')
      const getVolumeSpy = vi.spyOn(getAudio(), 'getVolume')

      await restoreVolume()

      expect(setVolumeSpy).not.toHaveBeenCalled()
      expect(getVolumeSpy).toHaveBeenCalled()
    } finally {
      delete (globalThis as Record<string, unknown>).SystemInfo
    }
  })
})
