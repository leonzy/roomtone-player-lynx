import { contrastRatio, foregroundOn, mixColor, readableColor } from './color-contrast.js'
import type { ResolvedTheme } from './theme-model.js'

export interface PlayerColors {
  background: string
  fallbackFrom: string
  fallbackTo: string
  scrimFrom: string
  scrimTo: string
  content: string
  secondary: string
  active: string
  /** Bounds include every possible cover pixel and the no-cover gradient. */
  backgrounds: readonly string[]
}

/** Cover pixels stay unknown; prove contrast against both luminance extremes. */
export function resolvePlayerColors(options: {
  theme: ResolvedTheme
  accent: string
  background: string
  opaque: boolean
}): PlayerColors {
  const light = options.theme === 'light'
  const foreground = light ? '#000000' : '#ffffff'
  // An imported pack can supply a surface of the opposite brightness. Keep the
  // player readable independently of that pack's unvalidated label/background pair.
  const background = contrastRatio(foreground, options.background) >= 18
    ? options.background : light ? '#ffffff' : '#000000'
  // Leave enough of the cover visible at both ends, while the bounds below
  // continue to guarantee readable text even on pure black/white artwork.
  const fromAlpha = options.opaque ? 1 : light ? 0.70 : 0.76
  const toAlpha = options.opaque ? 1 : 0.82
  const fallbackFrom = options.opaque ? background : mixColor(background, options.accent, 0.08)
  const fallbackTo = options.opaque ? background : mixColor(background, options.accent, 0.03)
  const backgrounds = [
    mixColor('#000000', background, fromAlpha),
    mixColor('#ffffff', background, fromAlpha),
    background, fallbackFrom, fallbackTo,
  ]
  const rgba = (alpha: number) => `rgba(${[1, 3, 5].map(offset => parseInt(background.slice(offset, offset + 2), 16)).join(', ')}, ${alpha})`
  return {
    background, fallbackFrom, fallbackTo,
    scrimFrom: rgba(fromAlpha), scrimTo: rgba(toAlpha),
    content: foregroundOn(background),
    active: readableColor({ preferred: options.accent, foreground, backgrounds, minimum: 7 }),
    secondary: readableColor({ preferred: mixColor(background, foreground, 0.62), foreground, backgrounds, minimum: options.opaque ? 7 : 4.5 }),
    backgrounds,
  }
}

export function playerColorVars(colors: PlayerColors): Record<string, string> {
  return {
    '--player-background': colors.background,
    '--player-fallback-from': colors.fallbackFrom,
    '--player-fallback-to': colors.fallbackTo,
    '--player-scrim-from': colors.scrimFrom,
    '--player-scrim-to': colors.scrimTo,
    '--player-content': colors.content,
    '--player-secondary': colors.secondary,
    '--player-lyric-active': colors.active,
  }
}
