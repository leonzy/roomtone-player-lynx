import { readLynxGlobal } from './native-modules.js'

/** Optional additive events: older shells keep their existing foreground behavior. */
export function subscribeAppVisibility(listener: (visible: boolean) => void): () => void {
  const emitter = readLynxGlobal()?.getJSModule?.('GlobalEventEmitter')
  if (!emitter?.addListener || !emitter.removeListener) return () => {}
  let active = true
  const resumed = () => {
    if (active) listener(true)
  }
  const paused = () => {
    if (active) listener(false)
  }
  emitter.addListener('SongloftLifecycle.resumed', resumed)
  emitter.addListener('SongloftLifecycle.paused', paused)
  return () => {
    active = false
    try {
      emitter.removeListener('SongloftLifecycle.resumed', resumed)
      emitter.removeListener('SongloftLifecycle.paused', paused)
    } catch {
      /* The owning view may already have been destroyed. */
    }
  }
}
