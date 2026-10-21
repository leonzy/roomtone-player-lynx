export interface PlaybackAnchor {
  positionMs: number
  atMs: number
  playing: boolean
  speed: number
  durationMs: number
}

/** Bound extrapolation when a host stalls; authoritative seek/progress always re-anchors it. */
export function estimatedPlaybackPosition(anchor: PlaybackAnchor, nowMs: number): number {
  const elapsed = anchor.playing
    ? Math.min(1000, Math.max(0, nowMs - anchor.atMs)) * anchor.speed
    : 0
  const position = Math.max(0, anchor.positionMs + elapsed)
  return anchor.durationMs > 0 ? Math.min(anchor.durationMs, position) : position
}

export function lyricWordProgress(
  word: { startMs: number; endMs: number },
  positionMs: number,
): number {
  if (word.endMs <= word.startMs) return positionMs >= word.startMs ? 1 : 0
  return Math.min(1, Math.max(0, (positionMs - word.startMs) / (word.endMs - word.startMs)))
}
