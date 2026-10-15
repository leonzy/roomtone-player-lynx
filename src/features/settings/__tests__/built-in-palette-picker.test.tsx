import '@testing-library/jest-dom'
import { act, fireEvent, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { ThemeProvider } from '../../../shared/theme/ThemeProvider.js'
import { BuiltInPalettePicker } from '../widgets/BuiltInPalettePicker.js'
import { createMemoryStorage } from '../../../core/storage/memory-storage.js'
import { setSongloftStorage } from '../../../core/storage/index.js'
import { changeAppTheme } from '../../../shared/theme/theme-model.js'
import { changeBuiltInPalette, getBuiltInPalette, PREF_BUILT_IN_PALETTE } from '../../../shared/theme/built-in-palette-model.js'
import { setActiveThemePack } from '../../../shared/theme/theme-pack-model.js'
import { activeAccentIconColor } from '../../../shared/ui/Icon.js'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

afterEach(async () => {
  setActiveThemePack(null)
  await changeBuiltInPalette('blue', createMemoryStorage())
})

test('actual picker recolors the root and icons, persists, and resumes after clearing a pack', async () => {
  const storage = createMemoryStorage()
  setSongloftStorage(storage)
  await changeAppTheme('light', storage)
  const tree = render(<ThemeProvider><BuiltInPalettePicker /></ThemeProvider>)
  const choice = (name: string) => tree.getByTestId(`palette-${name}`) as HTMLElement
  await act(async () => {})
  const styles = () => (tree.container.firstElementChild as unknown as { style: Record<string, string> }).style
  const oldAccent = styles()['--accent']
  await act(async () => { fireEvent.tap(choice('rose')) })
  expect(styles()['--accent']).not.toBe(oldAccent)
  expect(activeAccentIconColor()).toBe(styles()['--accent'])
  expect(getBuiltInPalette()).toBe('rose')
  expect(await storage.prefs.get(PREF_BUILT_IN_PALETTE)).toBe('rose')
  expect(choice('rose').className).toContain('palette-choice--selected')
  await act(async () => { setActiveThemePack({ themeId: 'test', data: {
    id: 'test', name: 'Test', author: '', description: '', version: '1', schemaVersion: 1,
    light: { seedColor: '#123456' },
  } }) })
  expect(styles()['--accent']).toBe('#123456')
  expect(choice('rose').className).toContain('palette-choice--disabled')
  await act(async () => { fireEvent.tap(choice('violet')) })
  expect(getBuiltInPalette()).toBe('rose')
  await act(async () => { setActiveThemePack(null) })
  expect(choice('rose').className).toContain('palette-choice--selected')
  expect(styles()['--accent']).toBe('#984061')
  expect(styles()['--player-lyric-active']).not.toBe('#123456')
})
