import { beforeEach, expect, test, vi } from 'vitest'
const host = vi.hoisted(() => ({ props: {} as Record<string, unknown>, module: {} as Record<string, unknown> }))
vi.mock('../native/native-modules.js', () => ({
  readLynxGlobal: () => ({ __globalProps: host.props }),
  readNativeModules: () => ({ SongloftNavigation: host.module }),
}))
import { resetNavigationModuleForTests, supportsAppExit } from '../native/navigation.js'
beforeEach(() => {
  resetNavigationModuleForTests()
  host.props = {}
  host.module = { setBackConsumable() {}, notifyBackHandled() {}, exitApp() {} }
})
test('an older shell exposing exitApp is insufficient without the shutdown capability', () => {
  expect(supportsAppExit()).toBe(false)
  host.props.androidExitAppStopsPlayback = 'true'
  expect(supportsAppExit()).toBe(false)
})
test('the new host capability and complete navigation module enable exit', () => {
  host.props.androidExitAppStopsPlayback = true
  expect(supportsAppExit()).toBe(true)
})
test('a capability flag cannot substitute for a missing native exit method', () => {
  host.props.androidExitAppStopsPlayback = true
  delete host.module.exitApp
  expect(supportsAppExit()).toBe(false)
})
