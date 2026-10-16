import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { afterEach, expect, test, vi } from 'vitest'

interface Dom { window: Window & typeof globalThis }
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string) => Dom }
const windows: Dom[] = []
afterEach(() => { windows.splice(0).forEach(dom => dom.window.close()); vi.restoreAllMocks() })
const source = readFileSync(resolve(__dirname, '../../web/viewport-keyboard-host.js'), 'utf8')

function setup(touch = 5) {
  const dom = new JSDOM('<lynx-view id="app"></lynx-view><input id="outside">')
  windows.push(dom)
  const { window } = dom
  const { document } = window
  const app = document.getElementById('app')!
  const shadow = app.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<div class="shell--narrow"><div class="shell__bottombar"></div><div class="mini-player"></div></div><x-input></x-input><x-textarea></x-textarea>'
  const field = shadow.querySelector('x-input')!.attachShadow({ mode: 'open' })
  field.innerHTML = '<input><input type="password"><input type="checkbox"><input readonly>'
  const area = shadow.querySelector('x-textarea')!.attachShadow({ mode: 'open' })
  area.innerHTML = '<textarea></textarea>'
  const viewport = new window.EventTarget() as EventTarget & { height: number; scale: number }
  viewport.height = 856
  viewport.scale = 1
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touch })
  Object.defineProperty(window.screen, 'height', { value: 960, configurable: true })
  window.innerWidth = 432
  window.innerHeight = 856
  const context = vm.createContext({ window, document })
  const load = () => vm.runInContext(source, context)
  const hidden = () => app.hasAttribute('data-software-keyboard')
  const resize = (height: number, width = window.innerWidth, screenHeight = window.screen.height) => {
    viewport.height = height
    window.innerHeight = height
    window.innerWidth = width
    Object.defineProperty(window.screen, 'height', { value: screenHeight, configurable: true })
    window.dispatchEvent(new window.Event('resize'))
    viewport.dispatchEvent(new window.Event('resize'))
  }
  const input = field.querySelector('input')!
  const textarea = area.querySelector('textarea')!
  load()
  return { window, document, app, shadow, field, input, textarea, viewport, resize, hidden, load }
}

test('nested input focus alone leaves the bottom controls visible; occupied keyboard area hides them', () => {
  const { input, resize, hidden } = setup()
  input.focus()
  expect(hidden()).toBe(false)
  resize(510)
  expect(hidden()).toBe(true)
  resize(856)
  expect(hidden()).toBe(false)
  expect(input.matches(':focus')).toBe(true)
})

test('focus transfers and blur keep controls hidden until the viewport is restored', () => {
  const { input, textarea, resize, hidden } = setup()
  input.focus()
  resize(510)
  textarea.focus()
  expect(hidden()).toBe(true)
  textarea.blur()
  expect(hidden()).toBe(true)
  resize(856)
  expect(hidden()).toBe(false)
})

test('browser toolbar changes, including a still-focused field after keyboard dismissal, do not hide controls', () => {
  const { input, resize, hidden } = setup()
  resize(912)
  input.focus()
  resize(856)
  expect(hidden()).toBe(false)
  resize(510)
  expect(hidden()).toBe(true)
  resize(856)
  expect(hidden()).toBe(false)
})

test('desktop focus/window resize and mobile resizes without an editor do not hide controls', () => {
  const desktop = setup(0)
  desktop.input.focus()
  desktop.resize(510)
  expect(desktop.hidden()).toBe(false)
  const mobile = setup()
  mobile.resize(510)
  expect(mobile.hidden()).toBe(false)
  mobile.input.focus()
  expect(mobile.hidden()).toBe(false)
})

test('outside, readonly and non-text inputs cannot trigger keyboard hiding', () => {
  const { document, field, resize, hidden } = setup()
  for (const el of [document.getElementById('outside')!, field.querySelector('[readonly]')!, field.querySelector('[type="checkbox"]')!]) {
    resize(856)
    ;(el as HTMLElement).focus()
    resize(510)
    expect(hidden()).toBe(false)
  }
})

test('password and multiline fields use the same keyboard lifecycle', () => {
  const { field, textarea, resize, hidden } = setup()
  for (const el of [field.querySelector('[type="password"]')!, textarea]) {
    resize(856)
    ;(el as HTMLElement).focus()
    resize(510)
    expect(hidden()).toBe(true)
  }
})

test('pinch zoom alone does not look like a keyboard', () => {
  const { input, viewport, hidden, window } = setup()
  input.focus()
  viewport.scale = 2
  viewport.height = 428
  viewport.dispatchEvent(new window.Event('resize'))
  expect(hidden()).toBe(false)
})

test('rotation with the keyboard open uses screen geometry and restores in either orientation', () => {
  const { input, resize, hidden } = setup()
  input.focus()
  resize(510)
  expect(hidden()).toBe(true)
  resize(160, 960, 432)
  expect(hidden()).toBe(true)
  resize(328, 960, 432)
  expect(hidden()).toBe(false)
  resize(856, 432, 960)
  expect(hidden()).toBe(false)
})

test('the fallback without VisualViewport still follows resizes-content layout changes', () => {
  const { input, resize, hidden, window, load } = setup()
  Object.defineProperty(window, 'visualViewport', { value: undefined })
  load()
  input.focus()
  resize(510)
  expect(hidden()).toBe(true)
  resize(856)
  expect(hidden()).toBe(false)
})

test('VirtualKeyboard geometry, when available, also detects a small or overlay keyboard without changing browser resize policy', () => {
  const { input, window, load, hidden } = setup()
  const keyboard = Object.assign(new window.EventTarget(), { boundingRect: { height: 0 } })
  Object.defineProperty(window.navigator, 'virtualKeyboard', { value: keyboard })
  load()
  input.focus()
  expect(hidden()).toBe(false)
  keyboard.boundingRect.height = 80
  keyboard.dispatchEvent(new window.Event('geometrychange'))
  expect(hidden()).toBe(true)
  expect(keyboard).not.toHaveProperty('overlaysContent')
  keyboard.boundingRect.height = 0
  keyboard.dispatchEvent(new window.Event('geometrychange'))
  expect(hidden()).toBe(false)
})

test('host style hides only floating controls inside the Lynx shadow root and survives reload', () => {
  const { shadow, app, window, load } = setup()
  const style = shadow.querySelector('#songloft-ime-style')!
  const css = new window.CSSStyleSheet()
  css.insertRule(style.textContent!)
  expect(css.cssRules[0]!.cssText).toContain('display: none !important')
  expect((css.cssRules[0] as CSSStyleRule).selectorText).toBe(':host([data-software-keyboard]) .shell__bottombar, :host([data-software-keyboard]) .shell--narrow .mini-player')
  load()
  expect(shadow.querySelectorAll('#songloft-ime-style')).toHaveLength(1)
  shadow.querySelector('#songloft-ime-style')!.remove()
  app.dispatchEvent(new window.Event('load'))
  expect(shadow.querySelectorAll('#songloft-ime-style')).toHaveLength(1)
})

test('destroy removes listeners, the host attribute and its style', () => {
  const { window, app, input, resize, hidden, shadow } = setup()
  input.focus()
  resize(510)
  expect(hidden()).toBe(true)
  ;(window as unknown as { __SONGLOFT_VIEWPORT_KEYBOARD__: { destroy(): void } }).__SONGLOFT_VIEWPORT_KEYBOARD__.destroy()
  expect(hidden()).toBe(false)
  expect(shadow.querySelector('#songloft-ime-style')).toBeNull()
  resize(856)
  resize(510)
  expect(app.hasAttribute('data-software-keyboard')).toBe(false)
})
