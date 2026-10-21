import { expect, test } from 'vitest'
import {
  estimatedPlaybackPosition,
  lyricWordProgress,
  type PlaybackAnchor,
} from '../domain/playback-clock.js'

test('interpolates between host ticks, follows speed and bounds stalled/ended playback', () => {
  const anchor: PlaybackAnchor = {
    positionMs: 500,
    atMs: 1000,
    playing: true,
    speed: 2,
    durationMs: 10000,
  }
  expect(estimatedPlaybackPosition(anchor, 1125)).toBe(750)
  expect(estimatedPlaybackPosition(anchor, 1500)).toBe(1500)
  expect(estimatedPlaybackPosition(anchor, 9000)).toBe(2500)
  expect(estimatedPlaybackPosition({ ...anchor, playing: false }, 1500)).toBe(500)
  expect(estimatedPlaybackPosition({ ...anchor, durationMs: 700 }, 1500)).toBe(700)
  expect(estimatedPlaybackPosition(anchor, 900)).toBe(500)
  // A seek replaces the anchor rather than carrying the previous extrapolation.
  expect(estimatedPlaybackPosition({ ...anchor, positionMs: 9000, atMs: 1500 }, 1550)).toBe(9100)
})

test('word progress is continuous and handles boundaries and zero-duration words', () => {
  const word = { startMs: 1000, endMs: 3000 }
  expect([0, 1000, 1500, 2000, 3000, 4000].map((t) => lyricWordProgress(word, t))).toEqual([
    0, 0, 0.25, 0.5, 1, 1,
  ])
  expect(lyricWordProgress({ startMs: 1000, endMs: 1000 }, 999)).toBe(0)
  expect(lyricWordProgress({ startMs: 1000, endMs: 1000 }, 1000)).toBe(1)
})
