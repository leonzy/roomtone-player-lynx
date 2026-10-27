import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { afterEach, expect, test, vi } from 'vitest'

const { JSDOM } = createRequire(import.meta.url)('jsdom')
const source = readFileSync(
  resolve(__dirname, '../../web/drag-scroll-host.js'),
  'utf8',
)
const windows: { close(): void }[] = []
afterEach(() => windows.splice(0).forEach((window) => window.close()))

function setup(horizontal = false) {
  const { window } = new JSDOM('<lynx-view></lynx-view>')
  windows.push(window)
  const root = window.document
    .querySelector('lynx-view')
    .attachShadow({ mode: 'open' })
  root.innerHTML =
    '<x-list><div id="row">Song</div><div accessibility-label="Menu" id="menu">Menu</div></x-list>'
  const host = root.querySelector('x-list')
  if (horizontal) host.setAttribute('scroll-orientation', 'horizontal')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<div part="content"><slot></slot></div>'
  const part = shadow.firstElementChild
  Object.defineProperties(part, {
    scrollHeight: { value: 1200 },
    clientHeight: { value: 400 },
    scrollWidth: { value: 1200 },
    clientWidth: { value: 400 },
  })
  part.scrollTop = 100
  part.scrollLeft = 100
  host.setPointerCapture = vi.fn()
  vm.runInNewContext(source, { window, document: window.document })
  const event = (
    type: string,
    x: number,
    y: number,
    target = root.querySelector('#row'),
    extra = {},
  ) => {
    const e = new window.MouseEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      ...extra,
    })
    Object.defineProperties(e, {
      pointerType: { value: 'mouse' },
      pointerId: { value: 1 },
    })
    target.dispatchEvent(e)
    return e
  }
  return { window, root, host, part, event }
}

test('mouse dragging scrolls the shadow part, captures beyond the row and suppresses its click', () => {
  const { host, part, event } = setup()
  event('pointerdown', 10, 100)
  event('pointermove', 10, 97)
  expect(part.scrollTop).toBe(100)
  event('pointermove', 10, 40)
  expect(part.scrollTop).toBe(160)
  expect(host.setPointerCapture).toHaveBeenCalledWith(1)
  event('pointerup', 10, 40)
  expect(event('click', 10, 40).defaultPrevented).toBe(true)
  expect(host.style.userSelect).toBe('')
  // A normal click still reaches the song.
  event('pointerdown', 10, 40)
  event('pointerup', 10, 40)
  expect(event('click', 10, 40).defaultPrevented).toBe(false)
})

test('horizontal scrollers drag on their own axis; actions, cancelled gestures and hover stay independent', () => {
  const { root, host, part, event } = setup(true)
  event('pointerdown', 100, 10, root.querySelector('#menu'))
  event('pointermove', 40, 10)
  expect(part.scrollLeft).toBe(100)
  event('pointerdown', 100, 10)
  event('pointermove', 40, 10)
  expect(part.scrollLeft).toBe(160)
  expect(part.scrollTop).toBe(100)
  event('pointercancel', 40, 10)
  event('pointermove', 20, 10)
  expect(part.scrollLeft).toBe(160)
  expect(host.style.userSelect).toBe('')
  event('pointerdown', 100, 10)
  event('pointermove', 40, 10, undefined, { buttons: 0 })
  expect(part.scrollLeft).toBe(160)
})

test('the deployed Web page loads and copies the mouse scroll host', () => {
  expect(
    readFileSync(resolve(__dirname, '../../web/index.html'), 'utf8'),
  ).toMatch(/<script defer src="\.\/drag-scroll-host\.js"><\/script>/)
  expect(
    readFileSync(
      resolve(__dirname, '../../scripts/copy-bundle-web.mjs'),
      'utf8',
    ),
  ).toContain("'drag-scroll-host.js'")
})
