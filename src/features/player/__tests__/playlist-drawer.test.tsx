import '@testing-library/jest-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'

import type { Song } from '../../../models/song.js'

// Exercise the real queue window. Stub only the marquee's native animation and
// measurement leaves; counting these mounts catches the 30,000-effect storm.
vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)

// Retain a renderer for the pre-fix native list in the isolated negative check.
vi.mock('../../library/widgets/VirtualList.js', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockVirtualList(),
)
const titleMount = vi.fn()
vi.mock('../../../shared/ui/ScrollingText.js', () => ({
  ScrollingText: ({ text, textClassName }: { text: string, textClassName: string }) => {
    titleMount(text)
    return <view><text className={textClassName}>{text}</text></view>
  },
}))

function song(id: number): Song {
  return { id, type: 'local', title: `Song ${id}`, artist: `Artist ${id}` } as Song
}

function defaultState() {
  return {
    showPlaylistDrawer: true,
    playlist: [song(1), song(2), song(3)],
    currentIndex: 0,
  }
}

let state = defaultState()

const playQueueIndex = vi.fn()
const removeFromPlaylist = vi.fn()
const closePlaylistDrawer = vi.fn()

vi.mock('../store/index.js', () => {
  function usePlayerStore<T>(selector?: (s: typeof state) => T) {
    return selector ? selector(state) : state
  }
  usePlayerStore.getState = () => ({
    ...state,
    playQueueIndex,
    removeFromPlaylist,
    closePlaylistDrawer,
  })
  return { usePlayerStore }
})

const { PlaylistDrawer } = await import('../widgets/PlaylistDrawer.js')

afterEach(() => {
  vi.clearAllMocks()
  state = defaultState()
})

async function renderDrawer() {
  const result = render(<PlaylistDrawer />)
  await act(async () => {
    await Promise.resolve()
  })
  return { ...getQueriesForElement(elementTree.root!), ...result }
}

test('renders small queues in full', async () => {
  const { getByText, queryByTestId } = await renderDrawer()
  expect(queryByTestId('playlist-drawer')).toBeInTheDocument()
  expect(getByText('Song 1')).toBeInTheDocument()
  expect(getByText('Song 3')).toBeInTheDocument()
})

test('30,000 songs mount only a window around the current song (songloft-org/songloft#525)', async () => {
  state = {
    showPlaylistDrawer: true,
    playlist: Array.from({ length: 30_000 }, (_, i) => song(i + 1)),
    currentIndex: 15_000,
  }
  const { getByText, queryByText } = await renderDrawer()
  expect(getByText('Song 15001')).toBeInTheDocument()
  expect(queryByText('Song 1')).not.toBeInTheDocument()
  expect(queryByText('Song 30000')).not.toBeInTheDocument()
  expect(titleMount.mock.calls.length).toBeGreaterThan(0)
  expect(titleMount.mock.calls.length).toBeLessThan(40)
})

function scrollTo(scrollTop: number) {
  const target = lynx.createSelectorQuery().select('.drawer__list')
  fireEvent.scroll(target as unknown as Element, { detail: { scrollTop } })
}

test('scrolling reaches distant rows and plays their original queue index', async () => {
  state = { ...state, playlist: Array.from({ length: 30_000 }, (_, i) => song(i + 1)) }
  const { getByText, queryByText } = await renderDrawer()
  titleMount.mockClear()
  await act(async () => scrollTo(20_000 * 68))
  expect(queryByText('Song 1')).not.toBeInTheDocument()
  expect(titleMount.mock.calls.length).toBeLessThan(40)
  fireEvent.tap(getByText('Song 20001').parentElement!, {})
  expect(playQueueIndex).toHaveBeenCalledWith(20_000)
  expect(closePlaylistDrawer).toHaveBeenCalledOnce()
})

test('the last song remains reachable and scrolling back restores the first', async () => {
  state = { ...state, playlist: Array.from({ length: 30_000 }, (_, i) => song(i + 1)) }
  const { getByText, queryByText } = await renderDrawer()
  await act(async () => scrollTo(29_999 * 68))
  expect(getByText('Song 30000')).toBeInTheDocument()
  expect(queryByText('Song 1')).not.toBeInTheDocument()
  await act(async () => scrollTo(-10))
  expect(getByText('Song 1')).toBeInTheDocument()
  expect(queryByText('Song 30000')).not.toBeInTheDocument()
})

test('opening at the tail clamps the initial offset to a complete viewport', async () => {
  state = { ...state, playlist: Array.from({ length: 30_000 }, (_, i) => song(i + 1)), currentIndex: 29_999 }
  const { getByText } = await renderDrawer()
  const scroller = getByText('Song 30000').closest('scroll-view')!
  expect(Number(scroller.getAttribute('initial-scroll-offset'))).toBeLessThanOrEqual(30_000 * 68 - 600)
  expect(getByText('Song 29992')).toBeInTheDocument()
})

test('queue replacement and empty queues do not leave stale rows', async () => {
  state = { ...state, playlist: Array.from({ length: 30_000 }, (_, i) => song(i + 1)), currentIndex: 29_999 }
  const { rerender } = await renderDrawer()
  state = { ...state, playlist: [song(9)], currentIndex: 0 }
  await act(async () => rerender(<PlaylistDrawer />))
  expect(getQueriesForElement(elementTree.root!).getByText('Song 9')).toBeInTheDocument()
  state = { ...state, playlist: [], currentIndex: -1 }
  await act(async () => rerender(<PlaylistDrawer />))
  expect(getQueriesForElement(elementTree.root!).queryByText('Song 9')).not.toBeInTheDocument()
})

test('the current song row wears the active wash, siblings do not', async () => {
  state = { showPlaylistDrawer: true, playlist: [song(1), song(2), song(3)], currentIndex: 1 }
  const { getByText } = await renderDrawer()
  const active = getByText('Song 2').parentElement!.parentElement!.parentElement!
  expect(active.className).toContain('drawer__row--active')
  const sibling = getByText('Song 1').parentElement!.parentElement!.parentElement!
  expect(sibling.className).not.toContain('drawer__row--active')
})

test('drag handles are gone — the queue is no longer sortable in-drawer', async () => {
  const { queryByTestId } = await renderDrawer()
  expect(queryByTestId('drawer-drag-1')).not.toBeInTheDocument()
  expect(queryByTestId('drawer-drag-2')).not.toBeInTheDocument()
})

test('tapping a row plays that song and closes the drawer', async () => {
  const { getByText } = await renderDrawer()
  // The meta column carries the row's `bindtap`; the title text sits inside it.
  fireEvent.tap(getByText('Song 3').parentElement!, {})
  await act(async () => {
    await Promise.resolve()
  })
  expect(playQueueIndex).toHaveBeenCalledWith(2)
  expect(closePlaylistDrawer).toHaveBeenCalledTimes(1)
})

test('every row keeps its ✕ remove affordance', async () => {
  const { getAllByText } = await renderDrawer()
  expect(getAllByText('✕')).toHaveLength(3)
  // fireEvent.tap does not dispatch catchtap; removal also needs runtime checks.
  expect(removeFromPlaylist).not.toHaveBeenCalled()
})
