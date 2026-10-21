import { useLyricStore } from '../store/lyric-store.js'
import { KaraokeLine } from './KaraokeLine.js'
import './VideoSubtitleOverlay.css'

export function VideoSubtitleOverlay({
  enabled,
  controlsVisible,
}: {
  enabled: boolean
  controlsVisible: boolean
}) {
  const line = useLyricStore((state) => state.lyrics[state.currentIndex])
  const synced = useLyricStore((state) => state.synced)
  const translation = useLyricStore((state) => state.translationMap.get(state.currentIndex))
  if (!enabled || !synced || !line?.text.trim()) return null
  return (
    <view
      className={controlsVisible ? 'video-subtitle video-subtitle--raised' : 'video-subtitle'}
      accessibility-element={false}
      data-testid='video-subtitle'
    >
      {line.words?.length ? (
        <KaraokeLine key={`${line.timeMs}:${line.text}`} line={line} video />
      ) : (
        <text className='video-subtitle__text' text-maxline='3'>
          {line.text}
        </text>
      )}
      {translation && (
        <text className='video-subtitle__translation' text-maxline='2'>
          {translation}
        </text>
      )}
    </view>
  )
}
