import { readNativeModules } from './native-modules.js'

/** Old shells safely ignore this newly added, fire-and-forget platform method. */
export function setKeepScreenOn(enabled: boolean): void {
  const mod = readNativeModules()?.SongloftPlatform as { setKeepScreenOn?: (enabled: boolean) => void } | undefined
  try { mod?.setKeepScreenOn?.(enabled) } catch { /* Screen policy must not interrupt playback. */ }
}
