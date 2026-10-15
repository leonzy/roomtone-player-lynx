import { useRef, useState, useSyncExternalStore } from '@lynx-js/react'
import type { ScrollEvent } from '@lynx-js/types'
import { useTranslation } from 'react-i18next'

import type { Song } from '../../../models/song.js'
import { useBreakpoint } from '../../../shared/responsive/useBreakpoint.js'
import { getFontScaleNumber, subscribeFontScale } from '../../../shared/theme/font-scale-model.js'
import { usePlayerStore } from '../store/index.js'
import { useBackHandler } from '../../../shared/nav/use-back-handler.js'
import { ModalMaterial } from '../../../shared/ui/ModalMaterial.js'
import { ModalScrim } from '../../../shared/ui/ModalScrim.js'
import { ScrollingText } from '../../../shared/ui/ScrollingText.js'
import { usePresence } from '../../../shared/ui/usePresence.js'
import '../../../shared/ui/overlay-motion.css'
import './SheetShell.css'

export function PlaylistDrawer() {
  const { t } = useTranslation()
  const show = usePlayerStore((s) => s.showPlaylistDrawer)
  const playlist = usePlayerStore((s) => s.playlist)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const fontScale = useSyncExternalStore(subscribeFontScale, getFontScaleNumber)

  useBackHandler(show, () => {
    usePlayerStore.getState().closePlaylistDrawer()
    return true
  })

  const close = () => usePlayerStore.getState().closePlaylistDrawer()

  const { mounted, leaving } = usePresence(show)
  if (!mounted) return null

  const leaveClass = leaving ? ' overlay--leave-fade' : ''
  const panelMotion = leaving ? 'overlay--leave-up' : 'overlay--enter-up'

  return (
    <view className='drawer__root' data-testid='playlist-drawer'>
      {/* Light page dim; the content panel owns its local material. */}

      <ModalScrim className={`drawer__backdrop${leaveClass}`} bindtap={close} />
      <view className={`drawer__panel drawer__panel--queue ${panelMotion}`} flatten={false} catchtap={() => {}}>
        <ModalMaterial shape='sheet' captureTarget='songloft-player-content' />
        <view className='drawer__handle-wrap'>
          <view className='drawer__handle' />
        </view>
        <view className='drawer__header'>
          <text className='drawer__title'>{t('player.upNext')}</text>
          <text className='drawer__count'>
            {t(
              playlist.length === 1 ? 'common.songCountOne' : 'common.songCountOther',
              { count: playlist.length },
            )}
          </text>
        </view>
        <QueueRows key={fontScale} playlist={playlist} currentIndex={currentIndex} fontScale={fontScale} />
      </view>
    </view>
  )
}

/**
 * Native <list> defers native layout, but mapping the whole queue still mounts
 * every React row and its marquee effects (songloft-org/songloft#525). Keep the
 * JS child set bounded too. The scroller contains only a viewport plus overscan;
 * two spacers preserve the full queue's scroll range on native and Web.
 */
function QueueRows({ playlist, currentIndex, fontScale }: {
  playlist: readonly Song[]
  currentIndex: number
  fontScale: number
}) {
  // 12px padding on each side of a >=44px control/two-line metadata block.
  // The same height sizes rows and offsets; large type expands both together.
  const rowHeight = 24 + 44 * Math.max(1, fontScale)
  const initialIndex = useRef(Math.max(0, Math.min(currentIndex, playlist.length - 1))).current
  const initialLength = useRef(playlist.length).current
  const [firstVisible, setFirstVisible] = useState(initialIndex)
  const { height, onLayoutChange } = useBreakpoint(0, '.drawer__list--queue')
  const viewport = height || 600
  // Android defers this attribute until offset + viewport <= content height.
  // Clamp the tail on mount, then refine once the actual viewport is measured.
  // Snapshot queue length so deletion cannot reset a user's browsing position.
  const initialOffset = Math.max(0, Math.min(initialIndex * rowHeight, initialLength * rowHeight - viewport))
  const visibleCount = Math.ceil(viewport / rowHeight) + 1
  const first = Math.min(firstVisible, Math.max(0, playlist.length - visibleCount))
  const start = Math.max(0, first - 8)
  const end = Math.min(playlist.length, first + visibleCount + 8)

  const onScroll = (event: ScrollEvent) => {
    const offset = event.detail.scrollTop
    if (Number.isFinite(offset)) setFirstVisible(Math.max(0, Math.floor(offset / rowHeight)))
  }

  return (
    <scroll-view
      id='player-queue-list'
      className='drawer__list drawer__list--queue'
      scroll-orientation='vertical'
      initial-scroll-offset={initialOffset}
      bindlayoutchange={onLayoutChange}
      bindscroll={onScroll}
    >
      <view className='drawer__window'>
        <view className='drawer__spacer' style={{ height: `${start * rowHeight}px` }} />
        {playlist.slice(start, end).map((song, offset) => {
          const index = start + offset
          return (
            <view
              key={`${song.type}:${song.id}:${index}`}
              style={{ height: `${rowHeight}px` }}
              className={index === currentIndex
                ? 'drawer__row drawer__row--active'
                : 'drawer__row'}
            >
              <view
                className='drawer__row-meta'
                bindtap={() => {
                  void usePlayerStore.getState().playQueueIndex(index)
                  usePlayerStore.getState().closePlaylistDrawer()
                }}
              >
                <ScrollingText textClassName='drawer__row-title' text={song.title} />
                {song.artist
                  ? <text className='drawer__row-artist'>{song.artist}</text>
                  : null}
              </view>
              <view
                className='drawer__row-remove'
                catchtap={() => usePlayerStore.getState().removeFromPlaylist(index)}
              >
                <text className='drawer__row-remove-glyph'>✕</text>
              </view>
            </view>
          )
        })}
        <view className='drawer__spacer' style={{ height: `${(playlist.length - end) * rowHeight}px` }} />
      </view>
    </scroll-view>
  )
}
