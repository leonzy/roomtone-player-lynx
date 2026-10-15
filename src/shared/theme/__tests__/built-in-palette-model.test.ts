import { afterEach, expect, test } from 'vitest'
import { createMemoryStorage } from '../../../core/storage/memory-storage.js'
import {
  applySavedBuiltInPalette, BUILT_IN_PALETTE_OPTIONS, changeBuiltInPalette,
  coerceBuiltInPalette, getBuiltInPalette, PREF_BUILT_IN_PALETTE,
} from '../built-in-palette-model.js'
import { themePackToStyleVars } from '../theme-pack-mapping.js'
import { pluginColorSchemeMap } from '../../../features/jsplugin/domain/plugin-color-scheme.js'
import { changeAppTheme } from '../theme-model.js'
import { activeAccentIconColor, ICON_COLORS } from '../../ui/Icon.js'
import { setActiveThemePack } from '../theme-pack-model.js'

afterEach(async () => {
  setActiveThemePack(null)
  await changeBuiltInPalette('blue', createMemoryStorage())
})

test('unknown preference defaults to Blue; all six choices restore from device storage', async () => {
  expect(coerceBuiltInPalette('unknown')).toBe('blue')
  const storage = createMemoryStorage()
  for (const palette of BUILT_IN_PALETTE_OPTIONS) {
    await changeBuiltInPalette(palette, storage)
    expect(await storage.prefs.get(PREF_BUILT_IN_PALETTE)).toBe(palette)
    await changeBuiltInPalette('blue', createMemoryStorage())
    await applySavedBuiltInPalette(storage)
    expect(getBuiltInPalette()).toBe(palette)
  }
})

test('a late startup read cannot overwrite a new choice and rapid writes are serialized', async () => {
  const storage = createMemoryStorage()
  let resolveRead!: (value: string) => void
  const read = applySavedBuiltInPalette({ ...storage, prefs: {
    ...storage.prefs, get: () => new Promise<string>(resolve => { resolveRead = resolve }),
  } })
  const writes = [changeBuiltInPalette('rose', storage), changeBuiltInPalette('forest', storage)]
  resolveRead('violet')
  await read
  await Promise.all(writes)
  expect(getBuiltInPalette()).toBe('forest')
  expect(await storage.prefs.get(PREF_BUILT_IN_PALETTE)).toBe('forest')
})

test('palettes update CSS, native SVG colors, and plugin payloads; a pack wins and clearing restores', async () => {
  const storage = createMemoryStorage()
  for (const theme of ['light', 'dark'] as const) {
    await changeAppTheme(theme, storage)
    for (const palette of BUILT_IN_PALETTE_OPTIONS) {
      await changeBuiltInPalette(palette, storage)
      const vars = themePackToStyleVars(null, theme, palette)
      expect(activeAccentIconColor()).toBe(vars['--accent'])
      expect(ICON_COLORS.primaryContent).toBe(vars['--accent-content'])
      expect(pluginColorSchemeMap(null, theme, palette).primary).toBe(vars['--accent'])
      expect(pluginColorSchemeMap(null, theme, palette).onPrimary).toBe(vars['--accent-content'])
    }
    const pack = { themeId: 'test', data: {
      id: 'test', name: 'Test', author: '', description: '', version: '1', schemaVersion: 1,
      light: { seedColor: '#123456' }, dark: { seedColor: '#abcdef' },
    } }
    setActiveThemePack(pack)
    expect(activeAccentIconColor()).toBe(pack.data[theme].seedColor)
    expect(themePackToStyleVars(pack.data, theme, 'rose')).toEqual(themePackToStyleVars(pack.data, theme, 'blue'))
    setActiveThemePack(null)
    expect(activeAccentIconColor()).toBe(themePackToStyleVars(null, theme, getBuiltInPalette())['--accent'])
  }
})
