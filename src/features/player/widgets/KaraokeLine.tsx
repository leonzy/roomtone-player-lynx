import { useEffect, useState } from '@lynx-js/react'

import { safeClearTimeout } from '../../../native/safe-timers.js'
import { subscribeAppVisibility } from '../../../native/app-visibility.js'
import {
  getSurfaceAppearance,
  subscribeSurfaceAppearance,
} from '../../../shared/theme/surface-appearance.js'
import {
  getActiveThemePack,
  subscribeActiveThemePack,
} from '../../../shared/theme/theme-pack-model.js'
import {
  getBuiltInPalette,
  subscribeBuiltInPalette,
} from '../../../shared/theme/built-in-palette-model.js'
import { themePackToStyleVars } from '../../../shared/theme/theme-pack-mapping.js'
import { mixColor } from '../../../shared/theme/color-contrast.js'
import { resolvePlayerColors } from '../../../shared/theme/player-colors.js'
import type { LyricLine } from '../domain/lyric-parser.js'
import {
  estimatedPlaybackPosition,
  lyricWordProgress,
  type PlaybackAnchor,
} from '../domain/playback-clock.js'
import { usePlayerStore } from '../store/player-store.js'
import './KaraokeLine.css'

function currentColors(video: boolean) {
  const surface = getSurfaceAppearance()
  const vars = themePackToStyleVars(getActiveThemePack()?.data, surface.theme, getBuiltInPalette())
  const colors = resolvePlayerColors({
    theme: surface.theme,
    accent: vars['--accent']!,
    background: vars['--system-background']!,
    opaque: surface.reduceTransparency || surface.increaseContrast,
  })
  return video ? { active: '#ffffff', secondary: '#b8d8ff' } : colors
}

/** Only the active line animates. No frame-rate updates enter the queue or lyric-list stores. */
export function KaraokeLine({ line, video = false }: { line: LyricLine; video?: boolean }) {
  const [position, setPosition] = useState(usePlayerStore.getState().currentTime)
  const [colors, setColors] = useState(() => currentColors(video))
  useEffect(() => {
    let alive = true
    let visible = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let previous = usePlayerStore.getState()
    const now = () => Date.now()
    const anchorFrom = (positionMs: number): PlaybackAnchor => ({
      positionMs,
      atMs: now(),
      playing: previous.isPlaying && !previous.isBuffering,
      speed: previous.speed,
      durationMs: previous.duration,
    })
    let anchor = anchorFrom(previous.currentTime)
    const lastWordEnd = line.words?.[line.words.length - 1]?.endMs ?? line.timeMs
    const cancel = () => {
      safeClearTimeout(timer as unknown as number)
      timer = undefined
    }
    const frame = () => {
      cancel()
      if (!alive) return
      const reduced = getSurfaceAppearance().reduceMotion
      const value = reduced ? previous.currentTime : estimatedPlaybackPosition(anchor, now())
      setPosition(value)
      if (
        visible &&
        !reduced &&
        anchor.playing &&
        value < lastWordEnd &&
        now() - anchor.atMs < 1000
      ) {
        timer = setTimeout(frame, 33)
      }
    }
    const updateColors = () => {
      setColors(currentColors(video))
      frame()
    }
    const stopPlayer = usePlayerStore.subscribe((state) => {
      if (
        state.currentTime === previous.currentTime &&
        state.isPlaying === previous.isPlaying &&
        state.isBuffering === previous.isBuffering &&
        state.speed === previous.speed &&
        state.currentSong === previous.currentSong &&
        state.audioTrack === previous.audioTrack
      )
        return
      const changedSource =
        state.currentSong !== previous.currentSong || state.audioTrack !== previous.audioTrack
      const positionMs =
        changedSource || state.currentTime !== previous.currentTime
          ? state.currentTime
          : estimatedPlaybackPosition(anchor, now())
      previous = state
      anchor = anchorFrom(positionMs)
      frame()
    })
    const stopVisibility = subscribeAppVisibility((next) => {
      visible = next
      if (!visible) cancel()
      else {
        anchor = anchorFrom(usePlayerStore.getState().currentTime)
        frame()
      }
    })
    const stops = [
      stopPlayer,
      stopVisibility,
      subscribeSurfaceAppearance(updateColors),
      subscribeActiveThemePack(updateColors),
      subscribeBuiltInPalette(updateColors),
    ]
    frame()
    return () => {
      alive = false
      cancel()
      stops.forEach((stop) => stop())
    }
  }, [line, video])

  return (
    <text className={video ? 'karaoke-line karaoke-line--video' : 'karaoke-line'} text-maxline='3'>
      {line.words?.map((word, index) => (
        <text
          key={index}
          style={{
            color: mixColor(colors.secondary, colors.active, lyricWordProgress(word, position)),
          }}
          data-testid={`karaoke-word-${index}`}
        >
          {word.text}
        </text>
      ))}
    </text>
  )
}
