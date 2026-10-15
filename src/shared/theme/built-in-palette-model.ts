import { getSongloftStorage } from '../../core/storage/index.js'
import type { SongloftStorage } from '../../core/storage/types.js'
import type { ResolvedTheme } from './theme-model.js'

export const PREF_BUILT_IN_PALETTE = 'built_in_palette'
export const BUILT_IN_PALETTE_OPTIONS = ['blue', 'teal', 'forest', 'rose', 'amber', 'violet'] as const
export type BuiltInPalette = typeof BUILT_IN_PALETTE_OPTIONS[number]

/** Preserve systemBlue by default; the other palettes provide explicit light/dark ink. */
export const BUILT_IN_PALETTES: Record<BuiltInPalette, Record<ResolvedTheme, string>> = {
  blue: { light: '#0088ff', dark: '#0091ff' },
  teal: { light: '#006b6b', dark: '#72d5d0' },
  forest: { light: '#386a20', dark: '#abd58b' },
  rose: { light: '#984061', dark: '#f5a8c4' },
  amber: { light: '#895100', dark: '#efbd70' },
  violet: { light: '#7351a1', dark: '#d1b7f1' },
}

export function coerceBuiltInPalette(value: unknown): BuiltInPalette {
  return BUILT_IN_PALETTE_OPTIONS.includes(value as BuiltInPalette) ? value as BuiltInPalette : 'blue'
}

let current: BuiltInPalette = 'blue'
let revision = 0
let writes = Promise.resolve()
const listeners = new Set<() => void>()

export function getBuiltInPalette(): BuiltInPalette { return current }
export function subscribeBuiltInPalette(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function publish(next: BuiltInPalette): void {
  if (next === current) return
  current = next
  listeners.forEach(listener => listener())
}

/** A late startup read must not overwrite a choice made while it was pending. */
export async function applySavedBuiltInPalette(storage: SongloftStorage = getSongloftStorage()): Promise<void> {
  const started = revision
  try {
    const saved = coerceBuiltInPalette(await storage.prefs.get(PREF_BUILT_IN_PALETTE))
    if (started === revision) publish(saved)
  } catch { /* Keep the session choice when device storage is unavailable. */ }
}

export async function changeBuiltInPalette(
  palette: BuiltInPalette,
  storage: SongloftStorage = getSongloftStorage(),
): Promise<void> {
  revision++
  const next = coerceBuiltInPalette(palette)
  publish(next)
  // Native storage calls may finish out of order. Serialize so the latest tap wins.
  writes = writes.then(async () => {
    try { await storage.prefs.set(PREF_BUILT_IN_PALETTE, next) }
    catch { /* The live choice remains usable without persistence. */ }
  })
  await writes
}
