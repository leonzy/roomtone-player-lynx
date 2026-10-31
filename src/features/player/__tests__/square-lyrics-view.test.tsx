import '@testing-library/jest-dom'
import { act, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { expect, test, vi } from 'vitest'

vi.mock('react-i18next', async () => (await import('../../../__tests__/_render-mocks.js')).mockReactI18next())
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => () => {} }))
vi.mock('../store/index.js', async original => {
  const actual = await original<typeof import('../store/index.js')>()
  const mocks = await import('../../../__tests__/_render-mocks.js')
  const { parseLrc } = await import('../domain/lyric-parser.js')
  const lyrics = parseLrc('[00:33.86]测[00:34.06]试[00:34.26]歌[00:34.46]词[00:34.71]\r\n[00:36.00]下一行')
  return { ...actual, usePlayerStore: mocks.makePlayerStoreMock(actual).usePlayerStore,
    useLyricStore: mocks.makeLyricStoreMock(actual, { lyrics, currentIndex: -1 }).useLyricStore }
})
const { LyricsView } = await import('../widgets/LyricsView.js')

test('a square-word LRC renders readable sentences instead of an icon for every timestamp', async () => {
  render(<LyricsView />)
  await act(async () => {})
  const query = getQueriesForElement(elementTree.root!)
  expect(query.getByText('测试歌词')).toBeInTheDocument()
  expect(query.getByText('下一行')).toBeInTheDocument()
  expect(elementTree.root!.querySelectorAll('.player-lyrics__line--note')).toHaveLength(0)
})
