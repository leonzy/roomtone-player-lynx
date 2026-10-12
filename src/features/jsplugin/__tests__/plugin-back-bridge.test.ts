import { afterEach, expect, test, vi } from 'vitest'
import { createPluginBackBridge, PLUGIN_BACK_TIMEOUT_MS } from '../domain/plugin-back-bridge.js'

function fixture() {
  const send = vi.fn()
  const onCanBack = vi.fn()
  const onUnhandled = vi.fn()
  const bridge = createPluginBackBridge({ send, onCanBack, onUnhandled })
  bridge.connect()
  const session = send.mock.calls[0]![0].session as string
  const state = (canBack: boolean) => bridge.receive({ type: 'songloft-back-state', session, canBack })
  const reply = (consumed: boolean, extra = {}) => bridge.receive({
    type: 'songloft-back-result', session, id: send.mock.calls.at(-1)![0].id, consumed, canBack: consumed, ...extra,
  })
  return { bridge, send, onCanBack, onUnhandled, session, state, reply }
}

afterEach(() => vi.useRealTimers())

test('state activates the page handler; a correlated consumed reply does not route back', () => {
  const f = fixture()
  f.state(true)
  expect(f.onCanBack).toHaveBeenLastCalledWith(true)
  expect(f.bridge.requestBack()).toBe(true)
  expect(f.send).toHaveBeenLastCalledWith({ type: 'songloft-back-request', session: f.session, id: 1 })
  f.reply(true)
  expect(f.onUnhandled).not.toHaveBeenCalled()
  f.bridge.dispose()
})

test('repeated keys wait for the current reply; duplicate replies cannot pop another layer', () => {
  const f = fixture()
  f.bridge.requestBack()
  f.bridge.requestBack()
  expect(f.send).toHaveBeenCalledTimes(2)
  f.reply(true)
  f.bridge.requestBack()
  f.reply(false, { id: 1 })
  expect(f.onUnhandled).not.toHaveBeenCalled()
  f.reply(false)
  f.reply(false)
  expect(f.onUnhandled).toHaveBeenCalledTimes(1)
  f.bridge.dispose()
})

test('declined back releases the internal-state flag and falls back exactly once', () => {
  const f = fixture()
  f.state(true)
  f.bridge.requestBack()
  f.reply(false, { canBack: false })
  expect(f.onCanBack).toHaveBeenLastCalledWith(false)
  expect(f.onUnhandled).toHaveBeenCalledTimes(1)
  f.bridge.dispose()
})

test('timeouts and transport failures release the flag and do not process late replies', () => {
  vi.useFakeTimers()
  const f = fixture()
  f.state(true)
  f.bridge.requestBack()
  vi.advanceTimersByTime(PLUGIN_BACK_TIMEOUT_MS)
  expect(f.onUnhandled).toHaveBeenCalledTimes(1)
  expect(f.onCanBack).toHaveBeenLastCalledWith(false)
  f.reply(true)
  expect(f.onUnhandled).toHaveBeenCalledTimes(1)
  f.send.mockImplementationOnce(() => { throw new Error('view is detached') })
  f.bridge.requestBack()
  expect(f.onUnhandled).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(PLUGIN_BACK_TIMEOUT_MS)
  expect(f.onUnhandled).toHaveBeenCalledTimes(2)
  f.bridge.dispose()
})

test('reload and unmount invalidate pending replies and cancel timers', () => {
  vi.useFakeTimers()
  const f = fixture()
  f.bridge.requestBack()
  const oldId = f.send.mock.calls.at(-1)![0].id
  f.bridge.connect()
  f.bridge.receive({ type: 'songloft-back-state', session: f.session, canBack: true })
  f.bridge.receive({ type: 'songloft-back-result', session: f.session, id: oldId, consumed: false })
  expect(f.onCanBack).toHaveBeenLastCalledWith(false)
  vi.advanceTimersByTime(PLUGIN_BACK_TIMEOUT_MS)
  expect(f.onUnhandled).not.toHaveBeenCalled()
  f.bridge.requestBack()
  f.bridge.dispose()
  const count = f.onCanBack.mock.calls.length
  f.reply(false)
  f.state(true)
  vi.advanceTimersByTime(PLUGIN_BACK_TIMEOUT_MS)
  expect(f.onUnhandled).not.toHaveBeenCalled()
  expect(f.onCanBack).toHaveBeenCalledTimes(count)
  expect(f.bridge.requestBack()).toBe(false)
})

test('business messages and malformed replies cannot consume or clear a pending key', () => {
  vi.useFakeTimers()
  const f = fixture()
  expect(f.bridge.receive({ type: 'songloft-host-call' })).toBe(false)
  f.bridge.requestBack()
  f.bridge.receive({ type: 'songloft-back-result', session: f.session, id: 1, consumed: 'true' })
  f.bridge.receive({ type: 'songloft-back-state', session: f.session, canBack: 'true' })
  vi.advanceTimersByTime(PLUGIN_BACK_TIMEOUT_MS)
  expect(f.onUnhandled).toHaveBeenCalledTimes(1)
  f.bridge.dispose()
})
