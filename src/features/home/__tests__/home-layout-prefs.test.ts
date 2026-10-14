import { beforeEach, expect, test, vi } from 'vitest'
import { createMemoryStorage } from '../../../core/storage/index.js'

beforeEach(() => vi.resetModules())

test('a late preference read cannot overwrite a new choice, and writes preserve the latest fields', async () => {
  const storage = createMemoryStorage()
  let resolveRead!: (value: string) => void
  const get = vi.spyOn(storage.prefs, 'get').mockImplementation(() => new Promise(resolve => { resolveRead = resolve }))
  const module = await import('../data/home-layout.js')
  const facade = await import('../../../core/storage/index.js')
  facade.setSongloftStorage(storage)
  const restoring = module.restoreHomeConfig()
  const layout = module.changeHomeConfig({ layout: 'grid' })
  const columns = module.changeHomeConfig({ columns: 6 })
  const rows = module.changeHomeConfig({ rows: 0 })
  const visibility = module.changeHomeConfig({ showRadios: false })
  resolveRead(JSON.stringify({ layout: 'carousel', columns: 2, rows: 1 }))
  await Promise.all([restoring, layout, columns, rows, visibility])
  expect(module.getHomeConfig()).toEqual({ layout: 'grid', columns: 6, rows: 0, showRadios: false })
  get.mockRestore()
  expect(JSON.parse((await storage.prefs.get(module.PREF_HOME_CONFIG))!)).toEqual(module.getHomeConfig())
})

test('stored layout, rows and columns restore in a new session', async () => {
  const storage = createMemoryStorage()
  await storage.prefs.set('home_playlist_config', JSON.stringify({ layout: 'list', columns: 4, rows: 3, showRadios: true }))
  const facade = await import('../../../core/storage/index.js')
  facade.setSongloftStorage(storage)
  const module = await import('../data/home-layout.js')
  await module.restoreHomeConfig()
  expect(module.getHomeConfig()).toEqual({ layout: 'list', columns: 4, rows: 3, showRadios: true })
})

test('hidden radios restore across sessions and can be enabled again', async () => {
  const storage = createMemoryStorage()
  await storage.prefs.set('home_playlist_config', JSON.stringify({ showRadios: false }))
  const facade = await import('../../../core/storage/index.js')
  facade.setSongloftStorage(storage)
  const module = await import('../data/home-layout.js')
  await module.restoreHomeConfig()
  expect(module.getHomeConfig().showRadios).toBe(false)
  await module.changeHomeConfig({ showRadios: true })
  expect(JSON.parse((await storage.prefs.get(module.PREF_HOME_CONFIG))!).showRadios).toBe(true)
})
