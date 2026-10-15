import { expect, test } from 'vitest'
import { BUILT_IN_PALETTES, BUILT_IN_PALETTE_OPTIONS } from '../built-in-palette-model.js'
import { contrastRatio, mixColor } from '../color-contrast.js'
import { playerColorVars, resolvePlayerColors } from '../player-colors.js'

for (const theme of ['light', 'dark'] as const) {
  for (const palette of BUILT_IN_PALETTE_OPTIONS) {
    test(`${theme}/${palette}: readable lyrics across cover extremes, gradient, and fallback`, () => {
      const colors = resolvePlayerColors({
        theme, accent: BUILT_IN_PALETTES[palette][theme],
        background: theme === 'light' ? '#ffffff' : '#000000', opaque: false,
      })
      for (const cover of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']) {
        for (let step = 0; step <= 20; step++) {
          const alpha = (theme === 'light' ? 0.86 : 0.82) + (theme === 'light' ? 0.08 : 0.08) * step / 20
          const background = mixColor(cover, colors.background, alpha)
          expect(contrastRatio(colors.active, background)).toBeGreaterThanOrEqual(7)
          expect(contrastRatio(colors.secondary, background)).toBeGreaterThanOrEqual(4.5)
          const fallback = mixColor(colors.fallbackFrom, colors.fallbackTo, step / 20)
          expect(contrastRatio(colors.active, fallback)).toBeGreaterThanOrEqual(7)
        }
      }
      const vars = playerColorVars(colors)
      expect(vars['--player-lyric-active']).toBe(colors.active)
      expect(vars['--player-scrim-from']).toContain(theme === 'light' ? '0.86' : '0.82')
    })
  }
  test(`${theme}: accessibility and invalid pack surfaces retain the contrast floor`, () => {
    for (const background of ['#000000', '#ffffff', '#666666', '#999999', '#fff0f5', '#1a0a10']) {
      for (const opaque of [false, true]) {
        const colors = resolvePlayerColors({ theme, accent: '#ffff00', background, opaque })
        for (const bg of colors.backgrounds) {
          expect(contrastRatio(colors.active, bg)).toBeGreaterThanOrEqual(7)
          expect(contrastRatio(colors.secondary, bg)).toBeGreaterThanOrEqual(opaque ? 7 : 4.5)
        }
        if (opaque) {
          expect(colors.scrimFrom).toContain(', 1)')
          expect(colors.fallbackFrom).toBe(colors.background)
          expect(colors.fallbackTo).toBe(colors.background)
        }
      }
    }
  })
}
