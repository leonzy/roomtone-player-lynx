import { expect, test } from 'vitest'
import { BUILT_IN_PALETTES, BUILT_IN_PALETTE_OPTIONS } from '../built-in-palette-model.js'
import { contrastRatio, mixColor } from '../color-contrast.js'
import { playerColorVars, resolvePlayerColors } from '../player-colors.js'

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: cover hue stays visible at both ends of the veil`, () => {
    const colors = resolvePlayerColors({ theme, accent: '#007aff', background: theme === 'light' ? '#ffffff' : '#000000', opaque: false })
    for (const scrim of [colors.scrimFrom, colors.scrimTo]) {
      const alpha = Number(scrim.match(/, ([\d.]+)\)$/)![1])
      const red = mixColor('#ff0000', colors.background, alpha)
      const blue = mixColor('#0000ff', colors.background, alpha)
      expect(Math.abs(parseInt(red.slice(1, 3), 16) - parseInt(blue.slice(1, 3), 16))).toBeGreaterThanOrEqual(40)
    }
  })
  for (const palette of BUILT_IN_PALETTE_OPTIONS) {
    test(`${theme}/${palette}: readable lyrics across cover extremes, gradient, and fallback`, () => {
      const colors = resolvePlayerColors({
        theme, accent: BUILT_IN_PALETTES[palette][theme],
        background: theme === 'light' ? '#ffffff' : '#000000', opaque: false,
      })
      for (const cover of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']) {
        for (let step = 0; step <= 20; step++) {
          const from = Number(colors.scrimFrom.match(/, ([\d.]+)\)$/)![1])
          const to = Number(colors.scrimTo.match(/, ([\d.]+)\)$/)![1])
          const alpha = from + (to - from) * step / 20
          const background = mixColor(cover, colors.background, alpha)
          expect(contrastRatio(colors.active, background)).toBeGreaterThanOrEqual(7)
          expect(contrastRatio(colors.secondary, background)).toBeGreaterThanOrEqual(4.5)
          expect(contrastRatio(colors.content, background)).toBeGreaterThanOrEqual(7)
          const fallback = mixColor(colors.fallbackFrom, colors.fallbackTo, step / 20)
          expect(contrastRatio(colors.active, fallback)).toBeGreaterThanOrEqual(7)
        }
      }
      const vars = playerColorVars(colors)
      expect(vars['--player-lyric-active']).toBe(colors.active)
      expect(vars['--player-scrim-from']).toBe(colors.scrimFrom)
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
