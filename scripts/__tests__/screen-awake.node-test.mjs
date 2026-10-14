import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../../web/screen-awake-host.js', import.meta.url), 'utf8')

function fixture(request) {
  const listeners = new Map()
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
  }
  const window = { addEventListener() {} }
  vm.runInNewContext(source, { window, document, navigator: request ? { wakeLock: { request } } : {} })
  return { host: window.__SONGLOFT_SCREEN_AWAKE__, document, visibility: () => listeners.get('visibilitychange')?.() }
}

const tick = () => new Promise(resolve => setImmediate(resolve))

test('acquires only on visible lyrics; releases in background and reacquires on return', async () => {
  let acquired = 0
  let released = 0
  const h = fixture(async type => {
    assert.equal(type, 'screen')
    acquired++
    return { addEventListener() {}, release: async () => { released++ } }
  })
  assert.equal(acquired, 0)
  h.host.setEnabled(true)
  await tick()
  assert.equal(h.host.state().held, true)
  h.document.visibilityState = 'hidden'
  h.visibility()
  await tick()
  assert.equal(released, 1)
  assert.equal(h.host.state().held, false)
  h.document.visibilityState = 'visible'
  h.visibility()
  await tick()
  assert.equal(acquired, 2)
  h.host.setEnabled(false)
  await tick()
  assert.equal(released, 2)
})

test('late acquisition is released after lyrics close or the host disposes', async () => {
  for (const action of ['close', 'dispose']) {
    let answer
    let released = 0
    const h = fixture(() => new Promise(resolve => { answer = resolve }))
    h.host.setEnabled(true)
    if (action === 'close') h.host.setEnabled(false)
    else h.host.dispose()
    answer({ addEventListener() {}, release: async () => { released++ } })
    await tick()
    assert.equal(released, 1)
    assert.equal(h.host.state().held, false)
  }
})

test('unsupported and denied browser wake locks do not interrupt playback', async () => {
  const unsupported = fixture()
  unsupported.host.setEnabled(true)
  assert.equal(unsupported.host.state().held, false)
  const denied = fixture(async () => { throw new Error('permission denied') })
  denied.host.setEnabled(true)
  await tick()
  assert.equal(denied.host.state().pending, false)
  assert.equal(denied.host.state().held, false)
})
