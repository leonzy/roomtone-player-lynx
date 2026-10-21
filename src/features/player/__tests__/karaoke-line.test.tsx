import '@testing-library/jest-dom'
import { act, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { usePlayerStore } from '../store/player-store.js'
import { KaraokeLine } from '../widgets/KaraokeLine.js'

const lifecycle = vi.hoisted(() => ({
  visibility: (_visible: boolean) => {},
  appearance: () => {},
  reduced: false,
  stopVisibility: vi.fn(),
  stopAppearance: vi.fn(),
}))
vi.mock('../../../native/app-visibility.js', () => ({
  subscribeAppVisibility: (listener: (visible: boolean) => void) => {
    lifecycle.visibility = listener
    return lifecycle.stopVisibility
  },
}))
vi.mock('../../../shared/theme/surface-appearance.js', () => ({
  getSurfaceAppearance: () => ({
    theme: 'light',
    reduceMotion: lifecycle.reduced,
    reduceTransparency: false,
    increaseContrast: false,
  }),
  subscribeSurfaceAppearance: (listener: () => void) => {
    lifecycle.appearance = listener
    return lifecycle.stopAppearance
  },
}))
const original = usePlayerStore.getState()
afterEach(() => {
  usePlayerStore.setState(original, true)
  lifecycle.reduced = false
  vi.useRealTimers()
  vi.clearAllMocks()
})
const line = {
  timeMs: 0,
  text: '晨光照亮',
  words: [
    { text: '晨光', startMs: 0, endMs: 3000 },
    { text: '照亮', startMs: 3000, endMs: 6000 },
  ],
}

test('active word interpolates without store ticks; buffering, background and unmount stop animation', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  usePlayerStore.setState({
    currentTime: 0,
    isPlaying: true,
    isBuffering: false,
    speed: 1,
    duration: 6000,
  })
  const view = render(<KaraokeLine line={line} />)
  const query = getQueriesForElement(elementTree.root!)
  const color = () => query.getByTestId('karaoke-word-0').getAttribute('style')
  const start = color()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200)
  })
  expect(color()).not.toBe(start)
  expect(usePlayerStore.getState().currentTime).toBe(0)
  await act(async () => {
    usePlayerStore.setState({ isBuffering: true })
  })
  const buffered = color()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  expect(color()).toBe(buffered)
  await act(async () => {
    usePlayerStore.setState({ currentTime: 1000, isBuffering: false, speed: 2 })
  })
  expect(color()).not.toBe(buffered)
  await act(async () => {
    lifecycle.visibility(false)
  })
  const hidden = color()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  expect(color()).toBe(hidden)
  view.unmount()
  expect(lifecycle.stopVisibility).toHaveBeenCalledOnce()
  expect(lifecycle.stopAppearance).toHaveBeenCalledOnce()
})

test('reduce motion uses authoritative progress and resumes interpolation when disabled', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  lifecycle.reduced = true
  usePlayerStore.setState({
    currentTime: 0,
    isPlaying: true,
    isBuffering: false,
    speed: 1,
    duration: 6000,
  })
  render(<KaraokeLine line={line} />)
  const query = getQueriesForElement(elementTree.root!)
  const color = () => query.getByTestId('karaoke-word-0').getAttribute('style')
  const start = color()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  expect(color()).toBe(start)
  await act(async () => {
    usePlayerStore.setState({ currentTime: 500 })
  })
  expect(color()).not.toBe(start)
  const tick = color()
  await act(async () => {
    lifecycle.reduced = false
    lifecycle.appearance()
    await vi.advanceTimersByTimeAsync(200)
  })
  expect(color()).not.toBe(tick)
})
