import { expect, test, vi } from 'vitest'
import { createMemoryStorage } from '../../../core/storage/index.js'
import { HomeFavoritesPreferences } from '../data/home-favorites.js'
import { DEFAULT_HOME_FAVORITES, parseHomeFavorites } from '../domain/home-favorites.js'

test('missing, partial and malformed choices keep both cards visible by default', () => {
  for (const raw of [undefined, null, {}, { showFavorites: 'false', showRadioFavorites: 0 }]) {
    expect(parseHomeFavorites(raw)).toEqual(DEFAULT_HOME_FAVORITES)
  }
  expect(parseHomeFavorites({ showFavorites: false })).toEqual({ showFavorites: false, showRadioFavorites: true })
})

test('choices restore, recover and stay isolated by server and account', async () => {
  const storage = createMemoryStorage()
  const prefs = new HomeFavoritesPreferences(() => storage)
  const a = JSON.stringify(['https://one', 'alice'])
  const b = JSON.stringify(['https://one', 'bob'])
  const c = JSON.stringify(['https://two', 'alice'])
  await prefs.change(a, { showFavorites: false, showRadioFavorites: false })
  expect(prefs.get(b)).toEqual(DEFAULT_HOME_FAVORITES)
  expect(prefs.get(c)).toEqual(DEFAULT_HOME_FAVORITES)
  expect(prefs.get(null)).toEqual(DEFAULT_HOME_FAVORITES)
  const restored = new HomeFavoritesPreferences(() => storage)
  await restored.restore(a)
  expect(restored.get(a)).toEqual({ showFavorites: false, showRadioFavorites: false })
  await restored.change(a, { showFavorites: true })
  expect(restored.get(a)).toEqual({ showFavorites: true, showRadioFavorites: false })
  expect(await storage.prefs.keys()).toEqual([`home_favorites_visibility:${a}`])
})

test('an edit before restoration preserves the stored sibling and serializes rapid writes', async () => {
  const storage = createMemoryStorage()
  let finishRead!: (value: string) => void
  vi.spyOn(storage.prefs, 'get').mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve }))
  const prefs = new HomeFavoritesPreferences(() => storage)
  const first = prefs.change('a', { showFavorites: false })
  const second = prefs.change('a', { showFavorites: true })
  finishRead(JSON.stringify({ showFavorites: true, showRadioFavorites: false }))
  await Promise.all([first, second])
  expect(prefs.get('a')).toEqual({ showFavorites: true, showRadioFavorites: false })
  expect(JSON.parse((await storage.prefs.get('home_favorites_visibility:a'))!)).toEqual(prefs.get('a'))
})

test('a late read for another account never changes the active account choices', async () => {
  const storage = createMemoryStorage()
  let finishRead!: (value: string) => void
  vi.spyOn(storage.prefs, 'get').mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve }))
  const prefs = new HomeFavoritesPreferences(() => storage)
  const readA = prefs.restore('a')
  await prefs.change('b', { showRadioFavorites: false })
  finishRead(JSON.stringify({ showFavorites: false, showRadioFavorites: true }))
  await readA
  expect(prefs.get('b')).toEqual({ showFavorites: true, showRadioFavorites: false })
  expect(prefs.get('a')).toEqual({ showFavorites: false, showRadioFavorites: true })
})
