import { expect, test, vi } from 'vitest'
import { render } from '@lynx-js/react/testing-library'
import { VirtualList } from '../widgets/VirtualList.js'

test('scroll callback changes reuse loaded rows; new pages and row callbacks invalidate them', () => {
  const items = Array.from({ length: 80 }, (_, id) => ({ id }))
  const itemKey = (item: { id: number }) => String(item.id)
  const renderItem = vi.fn((item: { id: number }) => (
    <text>{String(item.id)}</text>
  ))
  const props = { items, itemKey, renderItem }
  const view = render(<VirtualList {...props} onScroll={() => {}} />)
  expect(renderItem).toHaveBeenCalledTimes(80)
  view.rerender(<VirtualList {...props} onScroll={() => {}} />)
  expect(renderItem).toHaveBeenCalledTimes(80)
  view.rerender(<VirtualList {...props} items={[...items, { id: 80 }]} />)
  expect(renderItem).toHaveBeenCalledTimes(161)
  const nextRender = vi.fn(renderItem)
  view.rerender(<VirtualList {...props} renderItem={nextRender} />)
  expect(nextRender).toHaveBeenCalledTimes(80)
})
