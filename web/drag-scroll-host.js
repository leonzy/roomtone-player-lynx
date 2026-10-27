/* Match Flutter's mouse drag scrolling on the Web host's actual scroll parts.
 * Business components run in a Worker and cannot capture DOM pointers.
 */
;(function () {
  'use strict'

  var gesture = null
  var suppressedClick = null
  var controls =
    'input,textarea,button,a,select,[contenteditable="true"],[role="button"],[accessibility-label],[ios-enable-simultaneous-touch],[consume-slide-event]'

  function pathOf(event) {
    return event.composedPath()
  }
  function finish() {
    if (!gesture) return
    var previous = gesture
    gesture = null
    previous.host.style.userSelect = previous.userSelect
    if (
      previous.host.hasPointerCapture &&
      previous.host.hasPointerCapture(previous.pointer)
    ) {
      previous.host.releasePointerCapture(previous.pointer)
    }
  }

  document.addEventListener(
    'pointerdown',
    function (event) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      finish()
      suppressedClick = null
      var path = pathOf(event)
      for (var i = 0; i < path.length; i++) {
        var node = path[i]
        if (!node || !node.matches) continue
        if (node.matches(controls)) return
        if (!node.matches('x-list,scroll-view')) continue
        if (node.getAttribute('enable-scroll') === 'false') return
        var part = node.matches('scroll-view')
          ? node
          : node.shadowRoot && node.shadowRoot.querySelector('[part="content"]')
        if (!part) continue
        var horizontal =
          node.getAttribute('scroll-orientation') === 'horizontal'
        if (
          horizontal
            ? part.scrollWidth <= part.clientWidth
            : part.scrollHeight <= part.clientHeight
        )
          continue
        gesture = {
          host: node,
          part: part,
          horizontal: horizontal,
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: part.scrollLeft,
          top: part.scrollTop,
          dragging: false,
          userSelect: node.style.userSelect,
        }
        node.style.userSelect = 'none'
        return
      }
    },
    true,
  )

  document.addEventListener(
    'pointermove',
    function (event) {
      if (!gesture || event.pointerId !== gesture.pointer) return
      if (event.buttons !== 1 || !gesture.host.isConnected) {
        finish()
        return
      }
      var delta = gesture.horizontal
        ? event.clientX - gesture.x
        : event.clientY - gesture.y
      if (!gesture.dragging) {
        if (Math.abs(delta) < 5) return
        gesture.dragging = true
        gesture.host.setPointerCapture(event.pointerId)
      }
      if (gesture.horizontal) gesture.part.scrollLeft = gesture.left - delta
      else gesture.part.scrollTop = gesture.top - delta
      event.preventDefault()
      event.stopPropagation()
    },
    { capture: true, passive: false },
  )

  document.addEventListener(
    'pointerup',
    function (event) {
      if (!gesture || event.pointerId !== gesture.pointer) return
      if (gesture.dragging) suppressedClick = gesture.host
      finish()
    },
    true,
  )
  document.addEventListener('pointercancel', finish, true)
  document.addEventListener('lostpointercapture', finish, true)
  window.addEventListener('blur', finish)
  document.addEventListener(
    'click',
    function (event) {
      if (!suppressedClick) return
      var host = suppressedClick
      suppressedClick = null
      if (pathOf(event).includes(host)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
    true,
  )
  document.addEventListener(
    'dragstart',
    function (event) {
      if (gesture) event.preventDefault()
    },
    true,
  )
})()
