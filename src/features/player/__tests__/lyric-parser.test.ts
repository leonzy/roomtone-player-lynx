import { describe, expect, test } from 'vitest'

import { findCurrentLine, parseLrc, parsePlain, stringifyLyric } from '../domain/lyric-parser.js'

describe('parseLrc', () => {
  test('interleaved square timestamps are words, not hundreds of empty repeated lines', () => {
    const lines = parseLrc('[00:33.86]测[00:34.06]试[00:34.26]歌[00:34.46]词[00:34.71]\r\n[00:36.00]下一行')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ timeMs: 33860, text: '测试歌词', words: [
      { text: '测', startMs: 33860, endMs: 34060 },
      { text: '试', startMs: 34060, endMs: 34260 },
      { text: '歌', startMs: 34260, endMs: 34460 },
      { text: '词', startMs: 34460, endMs: 34710 },
    ] })
    expect(stringifyLyric(lines)).toBe('[00:33.860]测试歌词\n[00:36.000]下一行\n')
  })
  test('parses mm:ss.xx timestamps into ms, sorted', () => {
    const lines = parseLrc('[00:12.50]Hello\n[00:01.00]First\n[01:00.000]Minute')
    expect(lines).toEqual([
      { timeMs: 1_000, text: 'First' },
      { timeMs: 12_500, text: 'Hello' },
      { timeMs: 60_000, text: 'Minute' },
    ])
  })

  test('handles multiple time tags on one line (each becomes a line)', () => {
    const lines = parseLrc('[00:01.00][00:02.00]Repeat')
    expect(lines).toEqual([
      { timeMs: 1_000, text: 'Repeat' },
      { timeMs: 2_000, text: 'Repeat' },
    ])
  })

  test('pads 1–2 digit fractional seconds to milliseconds', () => {
    expect(parseLrc('[00:00.5]x')[0].timeMs).toBe(500)
    expect(parseLrc('[00:00.05]x')[0].timeMs).toBe(50)
  })

  test('skips lines without a time tag / blank lines', () => {
    expect(parseLrc('metadata line\n\n[00:03.00]Line')).toEqual([
      { timeMs: 3_000, text: 'Line' },
    ])
  })
})

test('parsePlain splits non-empty lines at time 0', () => {
  expect(parsePlain('a\n\n  b  \nc')).toEqual([
    { timeMs: 0, text: 'a' },
    { timeMs: 0, text: 'b' },
    { timeMs: 0, text: 'c' },
  ])
})

describe('findCurrentLine', () => {
  const lines = [
    { timeMs: 1_000, text: 'a' },
    { timeMs: 2_000, text: 'b' },
    { timeMs: 3_000, text: 'c' },
  ]

  test('returns -1 before the first line', () => {
    expect(findCurrentLine(lines, 0)).toBe(-1)
    expect(findCurrentLine(lines, 999)).toBe(-1)
  })

  test('returns the last line whose time is <= position', () => {
    expect(findCurrentLine(lines, 1_000)).toBe(0)
    expect(findCurrentLine(lines, 2_500)).toBe(1)
    expect(findCurrentLine(lines, 3_000)).toBe(2)
  })

  test('stays on the last line past the end', () => {
    expect(findCurrentLine(lines, 999_999)).toBe(2)
  })

  test('returns -1 for empty lyrics', () => {
    expect(findCurrentLine([], 1_000)).toBe(-1)
  })
})

describe('stringifyLyric', () => {
  test('formats lines as [mm:ss.mmm]text, zero-padded, trailing newline', () => {
    expect(stringifyLyric([
      { timeMs: 1_000, text: 'First' },
      { timeMs: 12_345, text: 'Hello' },
      { timeMs: 601_234, text: 'Minute' },
    ])).toBe('[00:01.000]First\n[00:12.345]Hello\n[10:01.234]Minute\n')
  })

  test('sorts lines by time before writing', () => {
    const out = stringifyLyric([
      { timeMs: 2_000, text: 'second' },
      { timeMs: 1_000, text: 'first' },
    ])
    expect(out).toBe('[00:01.000]first\n[00:02.000]second\n')
  })

  test('clamps negative timestamps to zero', () => {
    expect(stringifyLyric([{ timeMs: -300, text: 'x' }])).toBe('[00:00.000]x\n')
  })

  test('empty text lines serialize as bare timestamps', () => {
    expect(stringifyLyric([{ timeMs: 5_000, text: '' }])).toBe('[00:05.000]\n')
  })

  test('round-trips parseLrc output unchanged (word timing dropped)', () => {
    const lrc = '[00:01.000]first\n[00:02.500]second line\n[01:03.250]third\n'
    expect(stringifyLyric(parseLrc(lrc))).toBe(lrc)
  })

  test('returns empty string for no lines', () => {
    expect(stringifyLyric([])).toBe('')
  })
})
