// Browser-only: fixed browsing controls must not float above the software IME.
// Keep resizes-content: the browser still needs room to reveal the edited field.
;(function () {
  window.__SONGLOFT_VIEWPORT_KEYBOARD__?.destroy()
  const app = document.getElementById('app')
  if (!app) return
  const viewport = window.visualViewport
  const keyboard = window.navigator.virtualKeyboard
  const removers = []
  const heights = new Map()
  let open = false
  let destroyed = false
  let chromeHeight = Math.min(160, Math.max(0, window.screen.height - height()))

  function height() {
    // Pinch zoom changes visualViewport.height without opening a keyboard.
    return viewport ? viewport.height * viewport.scale : window.innerHeight
  }
  function editable() {
    let target = document.activeElement
    while (target?.shadowRoot?.activeElement) target = target.shadowRoot.activeElement
    if (!target || target.getRootNode() === document) return false
    let root = target.getRootNode()
    while (root.host && root.host !== app) root = root.host.getRootNode()
    if (root.host !== app || target.disabled || target.readOnly) return false
    if (target.tagName === 'TEXTAREA' || target.isContentEditable) return true
    return target.tagName === 'INPUT' && /^(text|search|email|url|tel|password|number)$/.test(target.type)
  }
  function update() {
    const current = height()
    const width = window.innerWidth
    const editing = editable()
    // A resize with no editor is a window/display change, not a keyboard.
    // Learn it before the next focus (e.g. Android split-screen + hardware IME).
    if (!open && !editing) heights.set(width, current)
    // Screen geometry supplies a conservative baseline when rotating with the
    // IME open. A width-specific history alone would learn the shrunken height.
    const baseline = heights.get(width) ?? Math.max(current, window.screen.height - chromeHeight)
    const reduced = keyboard?.boundingRect.height > 0
      || baseline - current > Math.max(120, baseline * 0.18)
    // Focus alone is insufficient (hardware keyboards). Retain the hidden state
    // during focus transfers/blur until the keyboard's occupied area is gone.
    open = window.navigator.maxTouchPoints > 0 && reduced && (open || editing)
    app.toggleAttribute('data-software-keyboard', open)
    if (!open && !reduced) {
      heights.set(width, Math.max(baseline, current))
      chromeHeight = Math.min(160, Math.max(0, window.screen.height - current))
    }
  }
  function listen(target, event, callback) {
    target?.addEventListener(event, callback)
    removers.push(() => target?.removeEventListener(event, callback))
  }
  function installStyle() {
    if (destroyed || !app.shadowRoot || app.shadowRoot.getElementById('songloft-ime-style')) return
    const style = document.createElement('style')
    style.id = 'songloft-ime-style'
    // display:none also removes hit targets and the accessibility subtree. Keep
    // component instances mounted, including media playback and tab selection.
    style.textContent = ':host([data-software-keyboard]) .shell__bottombar, :host([data-software-keyboard]) .shell--narrow .mini-player { display: none !important; }'
    app.shadowRoot.append(style)
  }
  listen(window, 'resize', update)
  listen(viewport, 'resize', update)
  listen(keyboard, 'geometrychange', update)
  listen(document, 'focusin', update)
  listen(document, 'focusout', update)
  listen(app, 'load', installStyle)
  window.customElements.whenDefined('lynx-view').then(installStyle)
  installStyle()
  update()
  window.__SONGLOFT_VIEWPORT_KEYBOARD__ = {
    destroy() {
      destroyed = true
      removers.forEach(remove => remove())
      app.removeAttribute('data-software-keyboard')
      app.shadowRoot?.getElementById('songloft-ime-style')?.remove()
    },
  }
})()
