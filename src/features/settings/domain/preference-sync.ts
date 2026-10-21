import type {
  PreferencePatch,
  UserPreferences,
} from '../../../core/storage/user-preference-events.js'
import { safeClearTimeout } from '../../../native/safe-timers.js'

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme_mode: 'system',
  play_mode: 'order',
  playlist_view_mode: 'grid',
  audio_quality: 'original',
  local_cache_max_size: 1073741824,
  volume: 50,
}

/** Reject invalid/partial responses rather than overwrite saved preferences with invented defaults. */
export function parseUserPreferences(raw: unknown): UserPreferences {
  const p = raw as UserPreferences | null
  if (
    !p ||
    !['system', 'light', 'dark'].includes(p.theme_mode) ||
    !['order', 'loop', 'single', 'random', 'singlePlay'].includes(p.play_mode) ||
    !['grid', 'list'].includes(p.playlist_view_mode) ||
    !['original', '128', '192', '320'].includes(p.audio_quality) ||
    !Number.isSafeInteger(p.local_cache_max_size) ||
    p.local_cache_max_size < 0 ||
    typeof p.volume !== 'number' ||
    !Number.isFinite(p.volume) ||
    p.volume < 0 ||
    p.volume > 100
  ) {
    throw new Error('Invalid user preferences')
  }
  return {
    theme_mode: p.theme_mode,
    play_mode: p.play_mode,
    playlist_view_mode: p.playlist_view_mode,
    audio_quality: p.audio_quality,
    local_cache_max_size: p.local_cache_max_size,
    volume: p.volume,
  }
}

interface SyncDeps {
  readLocal: () => Promise<UserPreferences>
  fetch: (assertCurrent: () => void) => Promise<unknown>
  save: (prefs: UserPreferences, assertCurrent: () => void) => Promise<void>
  apply: (
    patch: PreferencePatch,
    canApply: (key: keyof UserPreferences) => boolean,
  ) => Promise<void>
  onError?: (error: unknown) => void
}

/** One instance belongs to one authenticated server/account session. */
export class PreferenceSync {
  private active = true
  private ready = false
  private loading = false
  private dirty: PreferencePatch = {}
  private value: UserPreferences = { ...DEFAULT_USER_PREFERENCES }
  private timer: ReturnType<typeof setTimeout> | undefined
  private saves = Promise.resolve()
  constructor(private readonly deps: SyncDeps) {}

  private assertCurrent = () => {
    if (!this.active) throw new Error('Preference session changed')
  }

  async start(): Promise<void> {
    if (!this.active || this.ready || this.loading) return
    this.loading = true
    try {
      const [local, response] = await Promise.all([
        this.deps.readLocal(),
        this.deps.fetch(this.assertCurrent),
      ])
      this.assertCurrent()
      const remote = parseUserPreferences(response)
      const firstUse = (Object.keys(DEFAULT_USER_PREFERENCES) as (keyof UserPreferences)[]).every(
        (key) => remote[key] === DEFAULT_USER_PREFERENCES[key],
      )
      this.value = { ...(firstUse ? local : remote), ...this.dirty }
      if (!firstUse) await this.deps.apply(remote, (key) => this.active && !(key in this.dirty))
      this.assertCurrent()
      this.ready = true
      if (firstUse || Object.keys(this.dirty).length) this.schedule()
    } catch (error) {
      // An unavailable server must not turn a later local edit into a full-default PUT.
      if (this.active) this.deps.onError?.(error)
    } finally {
      this.loading = false
    }
  }

  change(patch: PreferencePatch): void {
    if (!this.active) return
    this.dirty = { ...this.dirty, ...patch }
    this.value = { ...this.value, ...patch }
    if (this.ready) this.schedule()
    else if (!this.loading) {
      safeClearTimeout(this.timer as unknown as number)
      this.timer = setTimeout(() => {
        this.timer = undefined
        void this.start()
      }, 500)
    }
  }

  private schedule(): void {
    safeClearTimeout(this.timer as unknown as number)
    this.timer = setTimeout(() => {
      this.timer = undefined
      const snapshot = { ...this.value }
      this.saves = this.saves
        .then(async () => {
          this.assertCurrent()
          await this.deps.save(snapshot, this.assertCurrent)
        })
        .catch((error) => {
          if (this.active) this.deps.onError?.(error)
        })
    }, 500)
  }

  stop(): void {
    this.active = false
    safeClearTimeout(this.timer as unknown as number)
    this.timer = undefined
  }
}
