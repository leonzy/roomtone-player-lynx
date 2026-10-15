import '@testing-library/jest-dom'
import { act, fireEvent, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test } from 'vitest'
import { PlayerBackdrop } from '../widgets/PlayerBackdrop.js'
import { changeIncreaseContrast } from '../../../shared/theme/increase-contrast-model.js'
import { changeReduceTransparency } from '../../../shared/theme/reduce-transparency-model.js'
import { createMemoryStorage } from '../../../core/storage/memory-storage.js'

afterEach(async () => {
  await changeIncreaseContrast(false, createMemoryStorage())
  await changeReduceTransparency(false, createMemoryStorage())
})

// Image load/error are custom Lynx events, absent from this testing-library
// version's convenience event map. Dispatch the actual bindEvent wire shape.
function imageEvent(image: Element, name: 'load' | 'error') {
  const event = new Event(`bindEvent:${name}`)
  Object.assign(event, { eventType: 'bindEvent', eventName: name, detail: {} })
  fireEvent(image, event)
}

test('loading, failure and missing covers share fallback; old song events cannot show a stale wash', async () => {
  const tree = render(<PlayerBackdrop coverUrl='cover-a' />)
  const root = tree.getByTestId('player-backdrop') as HTMLElement
  const image = root.querySelector('image')!
  expect(root.querySelector('.player-backdrop__scrim')).toBeNull()
  await act(async () => { imageEvent(image, 'load') })
  expect(root.querySelector('.player-backdrop__scrim')).not.toBeNull()
  await act(async () => { tree.rerender(<PlayerBackdrop coverUrl='cover-b' />) })
  expect(root.querySelector('.player-backdrop__scrim')).toBeNull()
  const second = root.querySelector('image')!
  await act(async () => { imageEvent(image, 'load') })
  expect(root.querySelector('.player-backdrop__scrim')).toBeNull()
  await act(async () => { imageEvent(second, 'error') })
  expect(root.querySelector('image')).toBeNull()
  expect(root.querySelector('.player-backdrop__scrim')).toBeNull()
  await act(async () => { tree.rerender(<PlayerBackdrop />) })
  expect(tree.getByTestId('player-backdrop')).toBe(root)
  expect(root.getAttribute('id')).toBe('songloft-backdrop')
})

test('contrast and transparency preferences unmount the cover without removing the capture source', async () => {
  const tree = render(<PlayerBackdrop coverUrl='cover-a' />)
  const root = tree.getByTestId('player-backdrop') as HTMLElement
  for (const setPreference of [changeIncreaseContrast, changeReduceTransparency]) {
    await act(async () => { await setPreference(true, createMemoryStorage()) })
    expect(root.querySelector('image')).toBeNull()
    await act(async () => { await setPreference(false, createMemoryStorage()) })
    expect(root.querySelector('image')).not.toBeNull()
  }
  expect(tree.getByTestId('player-backdrop')).toBe(root)
})
