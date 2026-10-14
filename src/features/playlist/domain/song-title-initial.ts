import { pinyin } from 'pinyin-pro'

/** Browsing hints preserve titles, playlist order and playback indices. */
export function songTitleInitial(title: string): string {
  const trimmed = title.trimStart()
  if (!trimmed) return '#'
  const first = pinyin(trimmed, { toneType: 'none', pattern: 'first' })[0]?.toUpperCase()
  return first && /^[A-Z]$/.test(first) ? first : '#'
}

export function songGroupInitial(titles: readonly string[], index: number): string | undefined {
  const current = songTitleInitial(titles[index] ?? '')
  return index === 0 || current !== songTitleInitial(titles[index - 1] ?? '') ? current : undefined
}
