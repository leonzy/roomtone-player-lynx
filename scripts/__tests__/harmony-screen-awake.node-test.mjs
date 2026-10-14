import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// Execute actual ArkTS source through TypeScript adapters; this is not an ArkTS build or device test.
function fixture() {
  const path = new URL('../../harmony/entry/src/main/ets/modules/platform/SongloftPlatformModule.ets', import.meta.url)
  const source = readFileSync(path, 'utf8').replace(/^import .*\n/gm, '')
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(result.outputText, { exports, LynxModule: class {}, ClientFileLog: { init() {} } })
  return { Host: exports.SongloftPlatformModule, module: new exports.SongloftPlatformModule({}, {}) }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('foreground gates the saved request; background releases and return restores it', async () => {
  const { Host, module } = fixture()
  const calls = []
  Host.setHostWindow({ setWindowKeepScreenOn: async enabled => { calls.push(enabled) } })
  module.setKeepScreenOn(true)
  await tick()
  assert.equal(calls.at(-1), false)
  Host.setForeground(true)
  await tick()
  assert.equal(calls.at(-1), true)
  Host.setForeground(false)
  await tick()
  assert.equal(calls.at(-1), false)
  Host.setForeground(true)
  await tick()
  assert.equal(calls.at(-1), true)
  module.setKeepScreenOn(false)
  await tick()
  assert.equal(calls.at(-1), false)
})

test('a pending enable cannot re-enable a destroyed or replaced window', async () => {
  const { Host, module } = fixture()
  const oldCalls = []
  const newCalls = []
  let finish
  const oldWindow = { setWindowKeepScreenOn: enabled => {
    oldCalls.push(enabled)
    return enabled ? new Promise(resolve => { finish = resolve }) : Promise.resolve()
  } }
  Host.setHostWindow(oldWindow)
  Host.setForeground(true)
  module.setKeepScreenOn(true)
  await tick()
  Host.setHostWindow({ setWindowKeepScreenOn: async enabled => { newCalls.push(enabled) } })
  finish()
  await tick()
  assert.equal(oldCalls.at(-1), false)
  assert.equal(newCalls.at(-1), false)
  module.setKeepScreenOn(true)
  await tick()
  assert.equal(newCalls.at(-1), true)
  Host.setHostWindow(null)
  await tick()
  assert.equal(newCalls.at(-1), false)
})
