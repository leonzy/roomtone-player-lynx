/** One active hosted document; replies are correlated across reloads and tab switches. */
export const PLUGIN_BACK_TIMEOUT_MS = 1000
let nextSession = 0

export interface PluginBackMessage {
  type: 'songloft-back-connect' | 'songloft-back-request'
  session: string
  id?: number
}

export function createPluginBackBridge(options: {
  send: (message: PluginBackMessage) => void
  onCanBack: (canBack: boolean) => void
  onUnhandled: () => void
}) {
  let session = ''
  let nextRequest = 0
  let pending: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const clearPending = () => {
    pending = null
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const unhandled = () => {
    clearPending()
    // A failed or timed-out document must not keep the native exit flag armed.
    options.onCanBack(false)
    options.onUnhandled()
  }

  return {
    connect() {
      if (disposed) return
      clearPending()
      session = `lynx-back-${++nextSession}`
      options.onCanBack(false)
      try { options.send({ type: 'songloft-back-connect', session }) } catch { /* Old hosts keep route back. */ }
    },
    requestBack(): boolean {
      if (disposed || !session) return false
      // A repeated key while waiting must not dispatch the same gesture twice.
      if (pending !== null) return true
      const id = ++nextRequest
      pending = id
      timer = setTimeout(unhandled, PLUGIN_BACK_TIMEOUT_MS)
      try { options.send({ type: 'songloft-back-request', session, id }) } catch { unhandled() }
      return true
    },
    receive(payload: unknown): boolean {
      if (!payload || typeof payload !== 'object') return false
      const message = payload as Record<string, unknown>
      if (message['type'] !== 'songloft-back-state' && message['type'] !== 'songloft-back-result') return false
      // Back traffic never goes through the business host-call dispatcher.
      if (disposed || message['session'] !== session) return true
      if (message['type'] === 'songloft-back-state') {
        if (typeof message['canBack'] === 'boolean') options.onCanBack(message['canBack'])
        return true
      }
      if (pending === null || message['id'] !== pending || typeof message['consumed'] !== 'boolean') return true
      clearPending()
      if (typeof message['canBack'] === 'boolean') options.onCanBack(message['canBack'])
      if (!message['consumed']) unhandled()
      return true
    },
    dispose() {
      disposed = true
      clearPending()
    },
  }
}
