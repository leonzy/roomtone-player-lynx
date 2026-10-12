import { afterEach, expect, test, vi } from 'vitest'

const h = vi.hoisted(() => ({
  web: false,
  action: { kind: 'exit-prompt' } as { kind: string },
  onBack: (_seq: number) => { },
  mirror: vi.fn(), ack: vi.fn(), exit: vi.fn(), toast: vi.fn(), navigate: vi.fn(),
}))

vi.mock('../../../native/navigation.js', () => ({
  getNavigationModule: () => ({ setBackConsumable: h.mirror, notifyBackHandled: h.ack, exitApp: h.exit }),
  installBackPressedListener: (fn: (seq: number) => void) => { h.onBack = fn },
}))
vi.mock('../../../native/web-platform.js', () => ({ isWebPlatform: () => h.web }))
vi.mock('../../ui/toast-store.js', () => ({ toast: { show: h.toast } }))
vi.mock('../../../i18n/index.js', () => ({ i18n: { t: () => 'press again' } }))
vi.mock('../../../core/navigation/route-back-action.js', () => ({
  currentBackAction: () => h.action,
  performRouteBack: () => {
    if (h.action.kind === 'exit-prompt') return false
    h.navigate()
    return true
  },
  setBackRouter: () => { },
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.resetModules()
  h.web = false
  h.action = { kind: 'exit-prompt' }
})

async function fixture() {
  vi.useFakeTimers()
  const controller = await import('../../../core/navigation/back-controller.js')
  const stack = await import('../back-stack.js')
  controller.initBackController({ subscribe: () => { } } as never)
  return { ...controller, ...stack }
}

test('new plugin state abandons an old exit prompt; root still lowers the flag for native second back', async () => {
  const f = await fixture()
  expect(h.mirror).toHaveBeenLastCalledWith(true)
  h.onBack(1)
  expect(h.toast).toHaveBeenCalledTimes(1)
  expect(h.mirror).toHaveBeenLastCalledWith(false)
  let remove = () => { }
  remove = f.pushBackHandler(() => { remove(); return true })
  expect(h.mirror).toHaveBeenLastCalledWith(true)
  h.onBack(2)
  expect(h.toast).toHaveBeenCalledTimes(1)
  expect(h.exit).not.toHaveBeenCalled()
  expect(h.mirror).toHaveBeenLastCalledWith(true)
  f.continueHostBack()
  expect(h.toast).toHaveBeenCalledTimes(2)
  expect(h.mirror).toHaveBeenLastCalledWith(false)
  expect(h.ack.mock.calls).toEqual([[1], [2]])
  f.resetBackControllerForTests()
})

test('Web root has no sentinel, while hosted internal state and overlays activate it', async () => {
  h.web = true
  const f = await fixture()
  expect(h.mirror).toHaveBeenLastCalledWith(false)
  const remove = f.pushBackHandler(() => true)
  expect(h.mirror).toHaveBeenLastCalledWith(true)
  remove()
  expect(h.mirror).toHaveBeenLastCalledWith(false)
  f.resetBackControllerForTests()
})

test('asynchronous unhandled replies preserve route back for pushed plugin pages', async () => {
  h.action = { kind: 'navigate' }
  const f = await fixture()
  f.continueHostBack()
  expect(h.navigate).toHaveBeenCalledTimes(1)
  expect(h.toast).not.toHaveBeenCalled()
  f.resetBackControllerForTests()
})
