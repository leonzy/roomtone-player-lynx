/* The document root contains both the host video and the Lynx subtitle/control layer. */
;(function () {
  window.__SONGLOFT_CREATE_VIDEO_FULLSCREEN__ = function (doc, isVideoOpen, notify) {
    var owned = false
    var button = null
    var generation = 0
    var pending = null
    var root = doc.documentElement
    function snapshot() {
      return {
        supported: typeof root.requestFullscreen === 'function' && doc.fullscreenEnabled !== false,
        active: doc.fullscreenElement === root,
      }
    }
    function removeButton() {
      if (button) {
        button.remove()
        button = null
      }
    }
    function changed() {
      if (doc.fullscreenElement !== root) owned = false
      else removeButton()
      notify(snapshot())
    }
    doc.addEventListener('fullscreenchange', changed)
    function request(label, allowPanel) {
      var state = snapshot()
      if (!state.supported || state.active) return Promise.resolve(state)
      if (!isVideoOpen()) return Promise.reject(new Error('Video is not open'))
      if (pending) return pending
      var expected = generation
      var operation
      try {
        operation = root.requestFullscreen()
      } catch (error) {
        operation = Promise.reject(error)
      }
      pending = Promise.resolve(operation)
        .then(
          function () {
            if (generation !== expected || !isVideoOpen()) {
              if (doc.fullscreenElement === root) return doc.exitFullscreen().then(snapshot)
              return snapshot()
            }
            owned = doc.fullscreenElement === root
            removeButton()
            notify(snapshot())
            return snapshot()
          },
          function (error) {
            if (generation !== expected || !isVideoOpen()) return snapshot()
            if (!allowPanel) throw error
            // Worker RPC may outlive transient activation. A real main-thread click
            // grants a fresh gesture without reloading the video or losing subtitles.
            removeButton()
            button = doc.createElement('button')
            button.dataset.songloftFullscreen = 'true'
            button.textContent = label
            button.style.cssText =
              'position:fixed;right:24px;top:24px;z-index:10000;min-height:44px;padding:12px 20px;border:1px solid white;border-radius:12px;background:#151515;color:white;font:inherit'
            button.addEventListener('click', function () {
              request(label, false).catch(function () {
                /* Keep the explicit retry button visible. */
              })
            })
            doc.body.appendChild(button)
            return Object.assign(snapshot(), { needsGesture: true })
          },
        )
        .finally(function () {
          pending = null
        })
      return pending
    }
    function close() {
      generation++
      removeButton()
      if (owned && doc.fullscreenElement === root) {
        owned = false
        return Promise.resolve(doc.exitFullscreen()).then(snapshot)
      }
      return Promise.resolve(snapshot())
    }
    return {
      state: snapshot,
      set: function (enabled, label) {
        return enabled ? request(label, true) : close()
      },
      close: close,
      dispose: function () {
        doc.removeEventListener('fullscreenchange', changed)
        return close()
      },
    }
  }
})()
