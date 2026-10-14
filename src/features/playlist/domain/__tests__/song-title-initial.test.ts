import { expect, test } from 'vitest'
import { songGroupInitial, songTitleInitial } from '../song-title-initial.js'
import { firstVisibleSongIndex, normalizeVisibleCells, playlistIndexFromRatio } from '../playlist-scroll.js'

test('Chinese, traditional titles and polyphonic phrases use pinyin initials', () => {
  expect(songTitleInitial('夜曲')).toBe('Y')
  expect(songTitleInitial('別讓愛凋落')).toBe('B')
  expect(songTitleInitial('重庆森林')).toBe('C')
  expect(songTitleInitial('  月亮代表我的心')).toBe('Y')
  expect(songTitleInitial('hello')).toBe('H')
  for (const title of ['', '   ', '123', '(Live)', '🎵夜曲', '별빛', 'あい']) expect(songTitleInitial(title)).toBe('#')
})

test('repeat initials are omitted only within a contiguous group, preserving order', () => {
  const titles = ['夜曲', '夜空', '大城小爱', '月亮']
  expect(titles.map((_, index) => songGroupInitial(titles, index))).toEqual(['Y', undefined, 'D', 'Y'])
})

test('visible song selection ignores the header, clipped rows and footer', () => {
  expect(firstVisibleSongIndex(normalizeVisibleCells([
    { itemKey: '5', top: 260, bottom: 324 },
    { itemKey: '6', top: 324, bottom: 388 },
  ], 347), [5, 6])).toBe(1)
  expect(firstVisibleSongIndex(normalizeVisibleCells({ attachedCells: [
    { itemKey: '5', top: -64, bottom: 0 }, { itemKey: '6', top: 0, bottom: 64 },
  ] }), [5, 6])).toBe(1)
  expect(firstVisibleSongIndex([
    { itemKey: '__header__', top: -200, bottom: 0 },
    { itemKey: '5', top: -64, bottom: 0 },
    { itemKey: '6', top: -20, bottom: 44 },
    { itemKey: '7', top: 44, bottom: 108 },
    { itemKey: '__footer__', top: 108, bottom: 160 },
  ], [5, 6, 7])).toBe(1)
  expect(playlistIndexFromRatio(1, 130)).toBe(129)
  expect(playlistIndexFromRatio(0.5, 130)).toBe(65)
  expect(playlistIndexFromRatio(NaN, 130)).toBe(0)
})
