import '@testing-library/jest-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import type { PlayerState } from '../store/player-store.js'

const renderCounts = vi.hoisted(() => ({ controls: vi.fn() }))

/**
 * MiniPlayer render smoke. Models player-store selector subscriptions,
 * `useNavigate`, and the favorites hook (react-query backed — would throw
 * `No QueryClient set` otherwise); asserts the mini-player shows the current
 * song's title + "artist · album" subtitle, the play control, and the skip
 * controls (prev/next) that were added so the user can skip tracks without
 * opening the full player.
 */
// Output controls have their own state/query integration coverage.
vi.mock('../../output/OutputPanels.js', () => ({ OutputRoot: () => null, OutputTransportControls: () => <view data-testid='output-controls-fixture' /> }))
vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => () => {} }))
// The testing env's SelectorQuery never answers `boundingClientRect`, so the
// real measure would leave its callback pending. Answer "no measurement"
// synchronously — the same path a host without the invoke bridge takes, which
// opens the panel docked rather than not at all.
vi.mock('../../../shared/ui/anchored-overlay.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTapAnchor: () => ({
    anchorId: 'mini-volume-anchor',
    anchorSelector: '#mini-volume-anchor',
    measure: (done: (result: null) => void) => done(null),
  }),
}))
vi.mock('../../library/data/favorites.js', () => ({
  useIsFavorite: () => false,
  useFavoriteToggle: () => { renderCounts.controls(); return { isFavorite: false, toggle: vi.fn(), isPending: false } },
  getFavoriteState: async () => false,
  toggleFavoriteNonReact: async () => {},
}))
// PlayerMoreMenu is part of the wide cluster now; these two stand-ins keep the
// renderer from touching native stores/query observers (same mocks as
// player-more-menu.test.tsx).
vi.mock('../data/audio-tracks-query.js', () => ({
  useAudioTracks: () => ({ data: [], isPending: false, isError: false, refetch: async () => {} }),
}))
vi.mock('../store/dlna-store.js', async (original) => {
  const actual = await original<typeof import('../store/dlna-store.js')>()
  const { makeDlnaStoreMock } = await import('../../../__tests__/_render-mocks.js')
  return makeDlnaStoreMock(actual)
})
vi.mock('../store/player-store.js', async () => {
  const actual = await vi.importActual<typeof import('../store/player-store.js')>(
    '../store/player-store.js',
  )
  const { makePlayerStoreMock } = await import('../../../__tests__/_render-mocks.js')
  const mocked = makePlayerStoreMock(actual)
  const { useEffect, useRef, useState } = await import('@lynx-js/react')
  const listeners = new Set<() => void>()
  // Model selector notifications without the renderer's unsupported
  // useSyncExternalStore consistency pass. Keep all existing fixture actions.
  function usePlayerStore<T>(selector: (s: PlayerState) => T) {
    const select = useRef(selector)
    select.current = selector
    const [value, setValue] = useState(() => selector(mocked.usePlayerStore.getState()))
    useEffect(() => {
      const update = () => setValue(select.current(mocked.usePlayerStore.getState()))
      listeners.add(update)
      return () => { listeners.delete(update) }
    }, [])
    return value
  }
  return { ...mocked, usePlayerStore: Object.assign(usePlayerStore, {
    getState: mocked.usePlayerStore.getState,
    setState: (value: Partial<PlayerState>) => {
      Object.assign(mocked.usePlayerStore.getState(), value)
      listeners.forEach(listener => listener())
    },
    subscribe: mocked.usePlayerStore.subscribe,
  }) }
})

const { MiniPlayer } = await import('../widgets/MiniPlayer.js')

test('an empty zone retains the player shell and its output controls', async () => {
  const { usePlayerStore } = await import('../store/player-store.js')
  const state = usePlayerStore.getState(), previous = state.currentSong
  state.currentSong = undefined
  try {
    render(<MiniPlayer />)
    await act(async () => { await Promise.resolve() })
    expect(elementTree.root!.querySelector('.mini-player--idle')).not.toBeNull()
    expect(elementTree.root!.querySelector('[data-testid="output-controls-fixture"]')).not.toBeNull()
    expect(getQueriesForElement(elementTree.root!).queryByText('Mock Song')).not.toBeInTheDocument()
  } finally { state.currentSong = previous }
})
const { changeMiniPlayerControls, miniPlayerControls } = await import('../data/mini-player-controls.js')
const { createMemoryStorage, setSongloftStorage } = await import('../../../core/storage/index.js')
const { setShellWidth } = await import('../../../shared/nav/shell-navigation.js')

// The play-mode button is gated on the measured shell width; the test renderer
// has no layout, so seed it with a phone width.
beforeEach(() => { setShellWidth(390) })

test('progress updates advance the timeline without rerendering transport and output controls', async () => {
  const { usePlayerStore } = await import('../store/player-store.js')
  const previous = { currentTime: usePlayerStore.getState().currentTime, duration: usePlayerStore.getState().duration }
  usePlayerStore.setState({ currentTime: 0, duration: 200_000 })
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  renderCounts.controls.mockClear()
  for (let i = 1; i <= 20; i++) {
    await act(async () => { usePlayerStore.setState({ currentTime: i * 250 }) })
  }
  expect(elementTree.root!.querySelector('.mini-player__timeline')?.textContent).toContain('0:05')
  expect(renderCounts.controls).not.toHaveBeenCalled()
  await act(async () => { usePlayerStore.setState(previous) })
})

afterEach(() => { vi.clearAllMocks(); miniPlayerControls.setState({ mode: 'prevNext' }); setSongloftStorage(createMemoryStorage()) })

test('button preferences update the mounted mini player and survive storage reload', async () => {
  setSongloftStorage(createMemoryStorage())
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  const query = getQueriesForElement(elementTree.root!)
  await act(async () => { changeMiniPlayerControls('playOnly') })
  expect(query.queryByTestId('icon-play')).toBeInTheDocument()
  expect(query.queryByTestId('icon-skip-next')).not.toBeInTheDocument()
  await act(async () => { changeMiniPlayerControls('prevNextMode') })
  expect(query.queryByTestId('icon-skip-next')).toBeInTheDocument()
  expect(query.queryByTestId('mini-play-mode')).toBeInTheDocument()
  const { loadMiniPlayerControls } = await import('../data/mini-player-controls.js')
  miniPlayerControls.setState({ mode: 'playOnly' })
  await act(async () => { await loadMiniPlayerControls() })
  expect(query.queryByTestId('mini-play-mode')).toBeInTheDocument()
})

test('shows the current song title, subtitle and play control', async () => {
  render(<MiniPlayer />)
  await act(async () => {
    await Promise.resolve()
  })
  const { queryByText, queryByTestId } = getQueriesForElement(elementTree.root!)

  expect(queryByText('Mock Song')).toBeInTheDocument()
  expect(queryByText('Mock Artist · Mock Album')).toBeInTheDocument()
  // Paused mock state -> the play (not pause) icon is rendered.
  expect(queryByTestId('icon-play')).toBeInTheDocument()
  expect(queryByTestId('icon-pause')).not.toBeInTheDocument()
})

/**
 * Skip controls: prev and next buttons render beside play/pause so the user
 * can skip tracks from the mini player. The standard mini-bar affordance
 * every major music player ships.
 */
test('shows prev/next skip controls alongside play/pause', async () => {
  render(<MiniPlayer />)
  await act(async () => {
    await Promise.resolve()
  })
  const { queryByTestId } = getQueriesForElement(elementTree.root!)

  expect(queryByTestId('icon-skip-prev')).toBeInTheDocument()
  expect(queryByTestId('icon-skip-next')).toBeInTheDocument()
})

/**
 * Wide-only favorite: the heart button is always rendered in the DOM (the
 * hook must stay mounted so state never desyncs during reflow), but CSS
 * hides it on narrow screens. The render test asserts the button and icon
 * exist; the CSS test asserts the show/hide rules.
 */
test('renders the favorite button (hidden via CSS on narrow)', async () => {
  render(<MiniPlayer />)
  await act(async () => {
    await Promise.resolve()
  })
  const { queryByTestId } = getQueriesForElement(elementTree.root!)

  expect(queryByTestId('mini-favorite-btn')).toBeInTheDocument()
  expect(queryByTestId('icon-heart')).toBeInTheDocument()
})

test('tapping a skip button calls the store action', async () => {
  render(<MiniPlayer />)
  await act(async () => {
    await Promise.resolve()
  })
  const { queryByTestId } = getQueriesForElement(elementTree.root!)

  const prevBtn = queryByTestId('icon-skip-prev')?.closest('[class*="mini-player__btn"]')
  expect(prevBtn).toBeTruthy()
  // catchtap prevents the tap from bubbling to the root's bindtap (which
  // would navigate to the full player instead of skipping).
  await act(async () => {
    fireEvent.tap(prevBtn!)
  })
})

/**
 * Volume entry point (songloft-org/songloft#536). The button is wide-only via
 * CSS, so it is always rendered; tapping it hands the measured anchor to the
 * root overlay store, where `MiniPlayerVolumePanel` picks it up. Unmounting
 * the mini player must close that root-mounted panel.
 */


/**
 * The fourth transport button (play mode) needs ~44px more than the three
 * buttons do. Below 340px — Flutter's `_kPlayModeMinWidth` — the preference
 * survives but the button drops out so the title keeps its width.
 */
test('the play-mode button drops out below 340px and returns above it', async () => {
  setShellWidth(320)
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  const query = getQueriesForElement(elementTree.root!)

  await act(async () => { changeMiniPlayerControls('prevNextMode') })
  expect(query.queryByTestId('mini-play-mode')).not.toBeInTheDocument()

  await act(async () => { setShellWidth(390) })
  expect(query.queryByTestId('mini-play-mode')).toBeInTheDocument()
})

/**
 * Wide-only secondary entries, mirroring Flutter's dense capsule: queue opens
 * the existing queue drawer, overflow opens the same menu as the full player's
 * `⋯`. CSS keeps both hidden on phones (`mini-player-css.test.ts`).
 */
test('renders the queue and overflow entries', async () => {
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  const { queryByTestId } = getQueriesForElement(elementTree.root!)

  expect(queryByTestId('mini-queue-btn')).not.toBeInTheDocument()
  expect(queryByTestId('mini-volume-btn')).not.toBeInTheDocument()
  expect(elementTree.root!.querySelectorAll('[data-testid="output-controls-fixture"]').length).toBeGreaterThan(0)
  expect(queryByTestId('mini-more-btn')).toBeInTheDocument()
})

test('the overflow entry opens the more menu above the capsule', async () => {
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  const query = getQueriesForElement(elementTree.root!)

  // `bindtap` lives on the trigger wrapper; the glyph itself is its child.
  const trigger = query.getByTestId('mini-more-btn').parentElement as unknown as {
    eventMap: Record<string, (event: { stopPropagation: () => void }) => void>
  }
  const onTap = trigger.eventMap['catchEvent:tap']
  // catchtap, not bindtap: the capsule root opens /player, so a bubbling
  // trigger would open the menu and navigate away in the same gesture.
  expect(onTap, 'mini more trigger must stop the tap from opening /player').toBeTypeOf('function')

  await act(async () => {
    onTap!({ stopPropagation: () => {} })
    await Promise.resolve()
  })
  expect(query.queryByTestId('popover-backdrop')).toBeInTheDocument()
})

/**
 * The capsule root opens `/player` on `bindtap`, and the popover panel and its
 * backdrop are descendants of that root even though they are siblings of the
 * trigger. Without their own `catchtap`, a menu row would run its action and
 * then also navigate — song info only appeared after landing on the full
 * player, and the sleep timer was unmounted with the shell before it could
 * show.
 */
test('the open more menu isolates its panel and backdrop from the capsule tap', async () => {
  render(<MiniPlayer />)
  await act(async () => { await Promise.resolve() })
  const query = getQueriesForElement(elementTree.root!)
  type TapNode = { eventMap: Record<string, (event: { stopPropagation: () => void }) => void> }
  const trigger = query.getByTestId('mini-more-btn').parentElement as unknown as TapNode

  await act(async () => {
    trigger.eventMap['catchEvent:tap']!({ stopPropagation: () => {} })
    await Promise.resolve()
  })

  const backdrop = query.getByTestId('popover-backdrop') as unknown as TapNode & {
    parentElement: Element | null
  }
  expect(
    backdrop.eventMap['catchEvent:tap'],
    'the backdrop must swallow the tap that closes it, or it also opens /player',
  ).toBeTypeOf('function')

  const panel = Array.from(backdrop.parentElement?.children ?? []).find((child) =>
    (child.className ?? '').includes('popover-menu'))
  expect(panel, 'the open panel is a sibling of the backdrop').toBeTruthy()
  expect(
    (panel as unknown as TapNode).eventMap['catchEvent:tap'],
    'menu rows must not bubble past the panel into the capsule root',
  ).toBeTypeOf('function')

  // The catcher only stops the bubble; it still closes the popover.
  await act(async () => {
    backdrop.eventMap['catchEvent:tap']!({ stopPropagation: () => {} })
  })
  expect(query.queryByTestId('popover-backdrop')).not.toBeInTheDocument()
})
