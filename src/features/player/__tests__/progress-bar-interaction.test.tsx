import '../../../shims/router-env.js'

import { act, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ currentTime: 10_000, duration: 120_000, seek: vi.fn() }))
const slider = vi.hoisted(() => ({ props: {} as {
  value: number
  onDragging: (value: number) => void
  onValueChange: (value: number) => void
  onValueCommit: (value: number) => void
} }))

vi.mock('../store/index.js', () => ({
  usePlayerStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
    getState: () => state,
  }),
}))
vi.mock('@lynx-js/lynx-ui-slider', () => ({
  SliderRoot: (props: typeof slider.props & { children?: unknown }) => {
    slider.props = props
    return <view>{props.children as never}</view>
  },
  SliderTrack: ({ children }: { children?: unknown }) => <view>{children as never}</view>,
  SliderIndicator: () => <view />,
  SliderThumb: ({ children }: { children?: unknown }) => <view>{children as never}</view>,
}))

const { ProgressBar } = await import('../widgets/ProgressBar.js')
afterEach(() => vi.clearAllMocks())

async function startTouch(ratio: number) {
  render(<ProgressBar />)
  await act(async () => { await Promise.resolve() })
  // The library calls these in the same event, before React can render the
  // new dragging state. Its controlled-value effect reads the next render.
  const first = slider.props
  await act(async () => {
    first.onDragging(ratio)
    first.onValueChange(ratio)
  })
}

test('first touch previews its position before release', async () => {
  await startTouch(0.75)
  expect(slider.props.value).toBe(0.75)
  expect(state.seek).not.toHaveBeenCalled()
})

test('a stationary tap retains its value through controlled sync and seeks once', async () => {
  await startTouch(0.5)
  // A stationary tap emits no move. SliderRoot syncs currentValue from the
  // controlled value, then commits that value on release.
  await act(async () => { slider.props.onValueCommit(slider.props.value) })
  expect(state.seek).toHaveBeenCalledExactlyOnceWith(60_000)
  expect(slider.props.value).toBeCloseTo(10_000 / 120_000)
})
