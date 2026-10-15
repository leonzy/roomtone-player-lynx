/** Small sRGB helpers shared by built-in palettes and the full-player surface. */
export function mixColor(from: string, to: string, amount: number): string {
  const channel = (offset: number) => Math.round(
    parseInt(from.slice(offset, offset + 2), 16) * (1 - amount)
    + parseInt(to.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0')
  return `#${channel(1)}${channel(3)}${channel(5)}`
}

export function contrastRatio(a: string, b: string): number {
  function luminance(hex: string): number {
    const channels = [1, 3, 5].map(offset => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (values[1]! + 0.05) / (values[0]! + 0.05)
}

export function foregroundOn(background: string): string {
  return contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000' : '#ffffff'
}

/** Strengthen a hue toward a foreground that is known to read on these surfaces. */
export function readableColor(options: {
  preferred: string
  foreground: string
  backgrounds: readonly string[]
  minimum: number
}): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mixColor(options.preferred, options.foreground, step / 100)
    if (options.backgrounds.every(bg => contrastRatio(candidate, bg) >= options.minimum)) return candidate
  }
  return options.foreground
}
