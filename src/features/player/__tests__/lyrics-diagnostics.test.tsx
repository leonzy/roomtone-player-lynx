import '@testing-library/jest-dom'
import { act, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { expect, test, vi } from 'vitest'

const detail = vi.hoisted(() => 'QQ音乐：请求超时；网易云：未找到匹配；LRCLIB：HTTP 503')
vi.mock('react-i18next', async () => (await import('../../../__tests__/_render-mocks.js')).mockReactI18next())
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => () => {} }))
vi.mock('../store/index.js', async original => {
  const actual = await original<typeof import('../store/index.js')>()
  const mocks = await import('../../../__tests__/_render-mocks.js')
  return { ...actual, usePlayerStore: mocks.makePlayerStoreMock(actual).usePlayerStore,
    useLyricStore: mocks.makeLyricStoreMock(actual, { lyrics: [], loadFailed: true, loadError: detail }).useLyricStore }
})
const { LyricsView } = await import('../widgets/LyricsView.js')
test('the visible failure panel shows individual provider reasons and a retry action', async () => {
  render(<LyricsView />)
  await act(async () => {})
  const query = getQueriesForElement(elementTree.root!)
  expect(query.getByText(detail)).toBeInTheDocument()
  expect(elementTree.root!.querySelector('.player-lyrics__refetch')).not.toBeNull()
})
