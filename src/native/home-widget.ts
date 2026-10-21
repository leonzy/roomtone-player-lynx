import { readLynxGlobal, readNativeModules } from './native-modules.js'

export interface HomeWidgetSnapshot {
  hasSong: boolean
  title: string
  artist: string
  coverUrl: string
  isPlaying: boolean
  isFavorite: boolean
  canNext: boolean
  canPrev: boolean
}
export type WidgetAction = 'open' | 'toggle' | 'next' | 'previous' | 'favorite'
interface WidgetHost {
  updateHomeWidget?: (json: string) => void
  consumeWidgetAction?: (callback: (action: string) => void) => void
}
function host(): WidgetHost | undefined {
  return readNativeModules()?.SongloftPlatform as WidgetHost | undefined
}
export function hasHomeWidgets(): boolean {
  return typeof host()?.updateHomeWidget === 'function'
}

export function updateHomeWidget(snapshot: HomeWidgetSnapshot): void {
  try {
    host()?.updateHomeWidget?.(JSON.stringify(snapshot))
  } catch {
    /* Older shells do not own widgets. */
  }
}

export function subscribeWidgetActions(listener: (action: WidgetAction) => void): () => void {
  const emitter = readLynxGlobal()?.getJSModule?.('GlobalEventEmitter')
  let alive = true
  const accept = (action: unknown) => {
    if (alive && ['open', 'toggle', 'next', 'previous', 'favorite'].includes(action as string))
      listener(action as WidgetAction)
  }
  const handler = (event: { action?: unknown }) => accept(event?.action)
  if (emitter?.addListener && emitter.removeListener)
    emitter.addListener('SongloftWidget.action', handler)
  try {
    host()?.consumeWidgetAction?.(accept)
  } catch {
    /* Cold-start actions are optional on older shells. */
  }
  return () => {
    alive = false
    try {
      emitter?.removeListener?.('SongloftWidget.action', handler)
    } catch {
      /* View already disposed. */
    }
  }
}
