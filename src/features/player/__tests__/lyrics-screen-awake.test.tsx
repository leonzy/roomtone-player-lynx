import { act, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { createMemoryStorage } from '../../../core/storage/memory-storage.js'
import { setSongloftStorage } from '../../../core/storage/index.js'
import { lyricsScreenAwake, changeLyricsScreenAwake } from '../../settings/data/lyrics-screen-awake.js'
import { useLyricsScreenAwake } from '../widgets/use-lyrics-screen-awake.js'

const { setKeepScreenOn } = vi.hoisted(() => ({ setKeepScreenOn: vi.fn() }))
vi.mock('../../../native/screen-awake.js', () => ({ setKeepScreenOn }))

afterEach(() => { vi.clearAllMocks(); lyricsScreenAwake.setState({ enabled: false }) })

function Lyrics({ visible }: { visible: boolean }) {
  useLyricsScreenAwake(visible)
  return <view />
}

test('only enabled, visible lyrics acquire the lock; hiding, toggling off and unmounting release it', async () => {
  const storage = createMemoryStorage()
  setSongloftStorage(storage)
  lyricsScreenAwake.setState({ enabled: false })
  const tree = render(<Lyrics visible />)
  await act(async () => {})
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(false)
  await act(async () => { await changeLyricsScreenAwake(true, storage) })
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(true)
  await act(async () => { tree.rerender(<Lyrics visible={false} />) })
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(false)
  await act(async () => { tree.rerender(<Lyrics visible />) })
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(true)
  await act(async () => { await changeLyricsScreenAwake(false, storage) })
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(false)
  await act(async () => { await changeLyricsScreenAwake(true, storage) })
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(true)
  tree.unmount()
  expect(setKeepScreenOn).toHaveBeenLastCalledWith(false)
})
