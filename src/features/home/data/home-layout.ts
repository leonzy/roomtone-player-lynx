import { useEffect, useState } from '@lynx-js/react'
import { getSongloftStorage } from '../../../core/storage/index.js'
import { coerceHomeConfig, DEFAULT_HOME_CONFIG, type HomeConfig } from '../domain/home-layout.js'

export const PREF_HOME_CONFIG = 'home_playlist_config'
let current = DEFAULT_HOME_CONFIG
let revision = 0
let loaded: Promise<void> | undefined
let writes = Promise.resolve()
const listeners = new Set<() => void>()

export function getHomeConfig(): HomeConfig { return current }

export async function restoreHomeConfig(): Promise<void> {
  if (loaded) return loaded
  const started = revision
  loaded = (async () => {
    try {
      const raw = await getSongloftStorage().prefs.get(PREF_HOME_CONFIG)
      if (revision !== started) return
      current = coerceHomeConfig(raw ? JSON.parse(raw) : undefined)
      listeners.forEach(listener => listener())
    } catch { /* Use defaults when storage is unavailable or malformed. */ }
  })()
  return loaded
}

export function changeHomeConfig(patch: Partial<HomeConfig>): Promise<void> {
  revision++
  current = coerceHomeConfig({ ...current, ...patch })
  listeners.forEach(listener => listener())
  const saved = JSON.stringify(current)
  writes = writes.then(async () => {
    try { await getSongloftStorage().prefs.set(PREF_HOME_CONFIG, saved) }
    catch { /* Live choices remain usable if persistence fails. */ }
  })
  return writes
}

export function useHomeConfig(): HomeConfig {
  const [config, setConfig] = useState(getHomeConfig)
  useEffect(() => {
    const changed = () => setConfig(getHomeConfig())
    listeners.add(changed)
    changed()
    void restoreHomeConfig()
    return () => { listeners.delete(changed) }
  }, [])
  return config
}
