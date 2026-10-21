/* Keyboard events originate on the main thread; player actions stay in the Worker. */
;(function () {
  var previous = window.__SONGLOFT_KEYBOARD__
  var state = previous ? previous.getState() : { enabled: false }
  if (previous) previous.destroy()
  var app = document.getElementById('app')
  var ownsFocus = false
  var composing = false
  var removers = []
  function listen(target, name, handler) {
    target.addEventListener(name, handler)
    removers.push(function () { target.removeEventListener(name, handler) })
  }
  function pathOf(event) { return event.composedPath ? event.composedPath() : [event.target] }
  function isInteractive(element) {
    return element && element.nodeType === 1 && (
      /^(INPUT|TEXTAREA|SELECT|BUTTON|IFRAME)$/.test(element.tagName)
      || element.isContentEditable
      || element.getAttribute('contenteditable') === 'true'
      || element.getAttribute('contenteditable') === ''
      || (element.tagName === 'A' && element.hasAttribute('href'))
      || /^(button|switch|slider|textbox|combobox)$/.test(element.getAttribute('role') || '')
    )
  }
  listen(document, 'pointerdown', function (event) { ownsFocus = pathOf(event).includes(app) })
  listen(document, 'focusin', function (event) { ownsFocus = pathOf(event).includes(app) })
  listen(window, 'blur', function () { ownsFocus = false; composing = false })
  listen(document, 'compositionstart', function () { composing = true })
  listen(document, 'compositionend', function () { composing = false })
  listen(document, 'keydown', function (event) {
    if (state.recording && app && app.isConnected && ownsFocus && document.hasFocus()
      && !composing && !event.isComposing && event.keyCode !== 229
      && !isInteractive(document.activeElement) && !pathOf(event).some(isInteractive)) {
      if (/^(Control|Shift|Alt|Meta)/.test(event.code) || event.repeat) return
      if (event.key === 'Tab') return
      if ((event.ctrlKey || event.metaKey) && /^(KeyL|KeyR|KeyT|KeyW|KeyN|KeyQ)$/.test(event.code)) return
      try {
        app.sendGlobalEvent('SongloftKeyboard.binding', [{ action: state.recording,
          binding: event.key === 'Escape' ? null : { code: event.code, ctrl: event.ctrlKey,
            meta: event.metaKey, shift: event.shiftKey, alt: event.altKey } }])
        event.preventDefault()
      } catch (_) {}
      return
    }
    if (!app || !app.isConnected || !ownsFocus || !document.hasFocus()
      || !state.enabled || state.blocked || !state.canPlay || event.defaultPrevented
      || composing || event.isComposing || event.keyCode === 229
      || document.querySelector('[data-songloft-transfer]')
      || isInteractive(document.activeElement) || pathOf(event).some(isInteractive)) return
    var action = null
    var bindings = state.bindings || {
      toggle: { code: 'Space' }, previous: { code: 'ArrowLeft', primary: true }, next: { code: 'ArrowRight', primary: true },
      volumeUp: { code: 'ArrowUp', primary: true }, volumeDown: { code: 'ArrowDown', primary: true },
    }
    Object.keys(bindings).some(function (candidate) {
      var b = bindings[candidate]
      var code = event.code || (event.key === ' ' ? 'Space' : event.key)
      if (b.code !== code || Boolean(b.alt) !== event.altKey || Boolean(b.shift) !== event.shiftKey) return false
      if (b.primary ? !(event.ctrlKey || event.metaKey) : Boolean(b.ctrl) !== event.ctrlKey || Boolean(b.meta) !== event.metaKey) return false
      if ((candidate === 'next' && !state.canNext) || (candidate === 'previous' && !state.canPrev)
        || (candidate === 'volumeUp' && state.volume >= 100) || (candidate === 'volumeDown' && state.volume <= 0)) return false
      action = candidate
      return true
    })
    if (!action || (event.repeat && !/^(volumeUp|volumeDown|seekForward|seekBackward)$/.test(action))
      || typeof app.sendGlobalEvent !== 'function') return
    try {
      app.sendGlobalEvent('SongloftKeyboard.action', [{ action: action }])
      event.preventDefault()
    } catch (_) { /* An unavailable bridge leaves the browser key unconsumed. */ }
  })
  window.__SONGLOFT_KEYBOARD__ = {
    configure: function (next) { state = next || { enabled: false } },
    getState: function () { return state },
    destroy: function () { removers.splice(0).forEach(function (remove) { remove() }); state = { enabled: false } },
  }
})()
