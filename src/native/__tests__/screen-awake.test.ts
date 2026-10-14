import { afterEach, expect, test, vi } from 'vitest'
import { setKeepScreenOn } from '../screen-awake.js'

afterEach(() => vi.unstubAllGlobals())

test('forwards the desired policy and tolerates missing, old and failed hosts', () => {
  const toggle = vi.fn()
  vi.stubGlobal('NativeModules', { SongloftPlatform: { setKeepScreenOn: toggle } })
  setKeepScreenOn(true)
  setKeepScreenOn(false)
  expect(toggle.mock.calls).toEqual([[true], [false]])
  vi.stubGlobal('NativeModules', {})
  expect(() => setKeepScreenOn(true)).not.toThrow()
  vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {} } })
  expect(() => setKeepScreenOn(true)).not.toThrow()
  vi.stubGlobal('NativeModules', { SongloftPlatform: { setKeepScreenOn() { throw new Error('host closed') } } })
  expect(() => setKeepScreenOn(false)).not.toThrow()
})
