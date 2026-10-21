import '../../../shims/router-env.js'
import '@testing-library/jest-dom'
import { expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { createMemoryStorage, setSongloftStorage } from '../../../core/storage/index.js'
import { useAppSessionStore } from '../../../store/app-session.js'

vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)
vi.mock('@lynx-js/lynx-ui-switch', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockLynxUiSwitch(),
)

const { HomeLayoutSettings } = await import('../widgets/HomeLayoutSettings.js')

test('the two home switches save independently and change account without sharing choices', async () => {
  const storage = createMemoryStorage()
  setSongloftStorage(storage)
  const session = useAppSessionStore.getState()
  session.setBaseUrl('https://home-favorites.example')
  session.setUsername('alice')
  render(<HomeLayoutSettings />)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
  const q = getQueriesForElement(elementTree.root!)
  const checked = (id: string) => q.getByTestId(id).querySelector('.app-switch')!.className.includes('ui-checked')
  const tap = async (id: string) => act(async () => {
    fireEvent.tap(q.getByTestId(id).querySelector('.app-switch') as unknown as Element)
    await new Promise(resolve => setTimeout(resolve, 10))
  })
  expect(checked('home-show-favorites')).toBe(true)
  expect(checked('home-show-radio-favorites')).toBe(true)
  await tap('home-show-favorites')
  expect(checked('home-show-favorites')).toBe(false)
  expect(checked('home-show-radio-favorites')).toBe(true)
  await tap('home-show-radio-favorites')
  const key = 'home_favorites_visibility:' + JSON.stringify(['https://home-favorites.example', 'alice'])
  expect(JSON.parse((await storage.prefs.get(key))!)).toEqual({ showFavorites: false, showRadioFavorites: false })
  await act(async () => { session.setUsername('bob'); await Promise.resolve() })
  expect(checked('home-show-favorites')).toBe(true)
  expect(checked('home-show-radio-favorites')).toBe(true)
  await act(async () => { session.setUsername('alice'); await Promise.resolve() })
  expect(checked('home-show-favorites')).toBe(false)
  await tap('home-show-favorites')
  expect(checked('home-show-favorites')).toBe(true)
  expect(checked('home-show-radio-favorites')).toBe(false)
  useAppSessionStore.getState().reset()
})
