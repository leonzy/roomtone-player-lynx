/* Browser main-thread implementation; the Lynx worker only sends the desired state. */
(function () {
  'use strict'

  function createScreenAwakeHost(doc, nav) {
    var requested = false
    var lock = null
    var pending = false
    var disposed = false
    var pageHidden = false

    function wanted() {
      return requested && !disposed && !pageHidden && doc.visibilityState === 'visible'
    }

    function release() {
      var previous = lock
      lock = null
      if (previous) void previous.release().catch(function () {})
    }

    function sync() {
      if (!wanted()) { release(); return }
      if (lock || pending || !nav.wakeLock || typeof nav.wakeLock.request !== 'function') return
      pending = true
      void nav.wakeLock.request('screen').then(function (next) {
        pending = false
        if (!wanted()) { void next.release().catch(function () {}); return }
        lock = next
        next.addEventListener('release', function () {
          if (lock === next) lock = null
        })
      }).catch(function () { pending = false })
    }

    doc.addEventListener('visibilitychange', sync)
    return {
      setEnabled: function (enabled) { requested = enabled === true; sync() },
      hide: function () { pageHidden = true; release() },
      show: function () { pageHidden = false; sync() },
      state: function () { return { requested: requested, held: lock !== null, pending: pending } },
      dispose: function () {
        disposed = true
        requested = false
        doc.removeEventListener('visibilitychange', sync)
        release()
      },
    }
  }

  window.__SONGLOFT_CREATE_SCREEN_AWAKE__ = createScreenAwakeHost
  var host = createScreenAwakeHost(document, navigator)
  window.__SONGLOFT_SCREEN_AWAKE__ = host
  window.addEventListener('pagehide', host.hide)
  window.addEventListener('pageshow', host.show)
})()
