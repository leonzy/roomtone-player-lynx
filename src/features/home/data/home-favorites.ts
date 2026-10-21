import { useEffect, useState } from '@lynx-js/react'
import { getSongloftStorage, type SongloftStorage } from '../../../core/storage/index.js'
import { useAppSessionStore } from '../../../store/app-session.js'
import { DEFAULT_HOME_FAVORITES, parseHomeFavorites, type HomeFavoritesVisibility } from '../domain/home-favorites.js'

interface Session {
  value: HomeFavoritesVisibility
  revision: number
  loaded?: Promise<void>
  writes: Promise<void>
}

/** Device-local choices isolated by server identity and logged-in account. */
export class HomeFavoritesPreferences {
  private sessions = new Map<string, Session>()
  private listeners = new Set<() => void>()
  constructor(private storage: () => SongloftStorage = getSongloftStorage) {}

  private session(scope: string): Session {
    let session = this.sessions.get(scope)
    if (!session) {
      session = { value: { ...DEFAULT_HOME_FAVORITES }, revision: 0, writes: Promise.resolve() }
      this.sessions.set(scope, session)
    }
    return session
  }

  get(scope: string | null): HomeFavoritesVisibility {
    return scope === null ? DEFAULT_HOME_FAVORITES : this.session(scope).value
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  restore(scope: string): Promise<void> {
    const session = this.session(scope)
    if (session.loaded) return session.loaded
    const revision = session.revision
    session.loaded = (async () => {
      try {
        const raw = await this.storage().prefs.get(`home_favorites_visibility:${scope}`)
        if (session.revision !== revision) return
        session.value = parseHomeFavorites(raw ? JSON.parse(raw) : undefined)
        this.listeners.forEach(listener => listener())
      } catch { /* Missing or malformed preferences keep the visible defaults. */ }
    })()
    return session.loaded
  }

  async change(scope: string, patch: Partial<HomeFavoritesVisibility>): Promise<void> {
    // Preserve the other stored switch even when the first edit precedes restoration.
    await this.restore(scope)
    const session = this.session(scope)
    session.revision++
    session.value = parseHomeFavorites({ ...session.value, ...patch })
    this.listeners.forEach(listener => listener())
    const saved = JSON.stringify(session.value)
    session.writes = session.writes.then(async () => {
      try { await this.storage().prefs.set(`home_favorites_visibility:${scope}`, saved) }
      catch { /* The current screen remains usable if local storage fails. */ }
    })
    return session.writes
  }
}

const preferences = new HomeFavoritesPreferences()

export function useHomeFavoritesVisibility() {
  // Subscribe through ReactLynx's effects; the store's React hook is not shared with its renderer.
  const [, changedSession] = useState(0)
  useEffect(() => useAppSessionStore.subscribe(() => changedSession(value => value + 1)), [])
  const session = useAppSessionStore.getState()
  const scope = session.username === null ? null : JSON.stringify([session.baseUrl, session.username])
  const [snapshot, setSnapshot] = useState(() => ({ scope, value: preferences.get(scope) }))
  useEffect(() => {
    const changed = () => setSnapshot({ scope, value: preferences.get(scope) })
    const stop = preferences.subscribe(changed)
    changed()
    if (scope !== null) void preferences.restore(scope)
    return stop
  }, [scope])
  return {
    config: snapshot.scope === scope ? snapshot.value : preferences.get(scope),
    change: (patch: Partial<HomeFavoritesVisibility>) => scope === null
      ? Promise.resolve() : preferences.change(scope, patch),
  }
}
