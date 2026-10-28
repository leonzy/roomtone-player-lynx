import { useMemo, useRef, useState, useSyncExternalStore } from '@lynx-js/react'
import type { ScrollEvent } from '@lynx-js/types'
import { useTranslation } from 'react-i18next'

import { Icon, ICON_COLORS, activeAccentIconColor } from '../../../shared/ui/Icon.js'
import { buildCoverUrl } from '../../../core/network/url-helper.js'
import { queueDirectory } from '../domain/queue-metadata.js'
import { formatDuration } from '../../library/data/format.js'
import { useZoneState } from '../../output/runtime.js'
import { useOutputText } from '../../output/text.js'
import type { Song } from '../../../models/song.js'
import { getShellWidth, subscribeShellWidth } from '../../../shared/nav/shell-navigation.js'
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

const subscribeQueueError = (listener: () => void) => useZoneState.subscribe(listener)
const getQueueError = () => useZoneState.getState().error

export function PlaylistDrawer() {
  const { t } = useTranslation()
  const wide = useSyncExternalStore(subscribeShellWidth, getShellWidth) >= 768
  const show = usePlayerStore((s) => s.showPlaylistDrawer)
  const playlist = usePlayerStore((s) => s.playlist)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const mode = usePlayerStore((s) => s.playMode) ?? 'order'
  const out = useOutputText()
  const queueError = useSyncExternalStore(subscribeQueueError, getQueueError)
  const [confirmClear, setConfirmClear] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showPlayed, setShowPlayed] = useState(false)
  const firstIndex = mode === 'order' && !showPlayed ? Math.max(0, currentIndex) : 0
  const remaining = Math.max(0, playlist.length - Math.max(0, currentIndex))
  const remainingDuration = useMemo(() => playlist.slice(Math.max(0, currentIndex)).reduce((sum, song) => sum + (song.duration ?? 0), 0), [playlist, currentIndex])
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
    <view className={`drawer__root drawer__root--queue${wide ? ' drawer__root--queue-wide' : ''}`} data-testid='playlist-drawer'>
      {/* Light page dim; the content panel owns its local material. */}

      <ModalScrim className={`drawer__backdrop${leaveClass}`} bindtap={close} />
      <view className={`drawer__panel drawer__panel--queue${wide ? ' drawer__panel--queue-wide' : ''} ${panelMotion}`} flatten={false} catchtap={() => {}}>
        <ModalMaterial shape='sheet' captureTarget='songloft-player-content' />
        <view className='drawer__handle-wrap'>
          <view className='drawer__handle' />
        </view>
        <view className='drawer__header'>
          <text className='drawer__title'>{out('queue')}</text>
          <text className='drawer__count'>
            {out('remaining')} {t(
              playlist.length === 1 ? 'common.songCountOne' : 'common.songCountOther',
              { count: remaining },
            )} · {formatDuration(remainingDuration)}
          </text>
          <view className='drawer__text-button' data-testid='queue-close' accessibility-element={true} accessibility-traits='button' accessibility-label={out('close')} bindtap={close}><Icon name='x' size={20} color={ICON_COLORS.content2} /></view>
        </view>
        <view className='drawer__toolbar'>
          <view className='drawer__modes'>{(['order', 'loop', 'single', 'random'] as const).map(value => <view key={value} className={`drawer__mode${mode === value ? ' drawer__mode--active' : ''}`} data-testid={'queue-mode-' + value} accessibility-element={true} accessibility-traits='button' accessibility-label={out(value === 'order' ? 'queueOrder' : value === 'loop' ? 'queueLoop' : value === 'single' ? 'queueSingle' : 'queueRandom')} bindtap={() => usePlayerStore.getState().setPlayMode(value)}><Icon name={value === 'order' ? 'order' : value === 'loop' ? 'repeat' : value === 'single' ? 'repeat-one' : 'shuffle'} size={21} color={mode === value ? activeAccentIconColor() : ICON_COLORS.content2} /></view>)}</view>
          <view className='drawer__queue-actions'>{mode === 'order' && currentIndex > 0 && <view className='drawer__text-button' data-testid='queue-history' accessibility-element={true} accessibility-traits='button' accessibility-label={out(showPlayed ? 'queuePendingOnly' : 'queueShowPlayed')} bindtap={() => setShowPlayed(!showPlayed)}><Icon name='history' size={20} color={showPlayed ? activeAccentIconColor() : ICON_COLORS.content2} /></view>}<view className='drawer__text-button' data-testid='queue-edit' accessibility-element={true} accessibility-traits='button' accessibility-label={out(editing ? 'queueDone' : 'queueEdit')} bindtap={() => setEditing(!editing)}><Icon name={editing ? 'check' : 'sort'} size={20} color={editing ? activeAccentIconColor() : ICON_COLORS.content2} /></view><view className='drawer__text-button' data-testid='queue-clear' accessibility-element={true} accessibility-traits='button' accessibility-label={out(confirmClear ? 'queueConfirmClear' : 'queueClear')} bindtap={() => { if (!playlist.length) return; if (!confirmClear) { setConfirmClear(true); return }; usePlayerStore.getState().clearPlaylist(); setConfirmClear(false) }}>{confirmClear ? <text>{out('queueConfirmClear')}</text> : <Icon name='trash' size={20} color={ICON_COLORS.content2} />}</view></view>
        </view>
        {queueError && <text className='drawer__empty'>{queueError}</text>}
        {!playlist.length && <text className='drawer__empty'>{out('queueEmpty')}</text>}
        <QueueRows key={fontScale + ':' + firstIndex} playlist={playlist} currentIndex={currentIndex} fontScale={fontScale} editing={editing} firstIndex={firstIndex} />
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
function QueueRows({ playlist, currentIndex, fontScale, editing, firstIndex }: {
  playlist: readonly Song[]
  currentIndex: number
  fontScale: number
  editing: boolean
  firstIndex: number
}) {
  const out = useOutputText()
  // 12px padding on each side of a >=44px control/two-line metadata block.
  // The same height sizes rows and offsets; large type expands both together.
  const rowHeight = 24 + 56 * Math.max(1, fontScale)
  const count = Math.max(0, playlist.length - firstIndex)
  const initialIndex = useRef(Math.max(0, Math.min(currentIndex - firstIndex, count - 1))).current
  const initialLength = useRef(count).current
  const [firstVisible, setFirstVisible] = useState(initialIndex)
  const { height, onLayoutChange } = useBreakpoint(0, '.drawer__list--queue')
  const viewport = height || 600
  // Android defers this attribute until offset + viewport <= content height.
  // Clamp the tail on mount, then refine once the actual viewport is measured.
  // Snapshot queue length so deletion cannot reset a user's browsing position.
  const initialOffset = Math.max(0, Math.min(initialIndex * rowHeight, initialLength * rowHeight - viewport))
  const visibleCount = Math.ceil(viewport / rowHeight) + 1
  const first = Math.min(firstVisible, Math.max(0, count - visibleCount))
  const start = Math.max(0, first - 8)
  const end = Math.min(count, first + visibleCount + 8)

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
        {playlist.slice(firstIndex + start, firstIndex + end).map((song, offset) => {
          const index = firstIndex + start + offset
          const directory = queueDirectory(song)
          const subtitle = [song.artist, song.album].filter(Boolean).join(' · ')
          return (
            <view
              key={`${song.type}:${song.id}:${index}`}
              style={{ height: `${rowHeight}px` }}
              className={index === currentIndex
                ? 'drawer__row drawer__row--active'
                : 'drawer__row'}
            >
              <view className='drawer__cover-wrap'>{song.coverUrl ? <image className='drawer__cover' mode='aspectFill' src={buildCoverUrl(song.coverUrl, song.updatedAt)} /> : <view className='drawer__cover drawer__cover--empty'><text>♫</text></view>}</view>
              <view
                className='drawer__row-meta'
                bindtap={() => {
                  void usePlayerStore.getState().playQueueIndex(index)
                  usePlayerStore.getState().closePlaylistDrawer()
                }}
              >
                <ScrollingText textClassName='drawer__row-title' text={song.title} />
                {subtitle
                  ? <text className='drawer__row-artist'>{subtitle}</text>
                  : null}
                {directory && <view className='drawer__row-folder' accessibility-element={true} accessibility-label={directory}><Icon name='folder' size={12} color={ICON_COLORS.content2} /><text className='drawer__row-directory'>{directory}</text></view>}
              </view>
              {!editing && <text className='drawer__row-duration'>{formatDuration(song.duration)}</text>}
              <view className='drawer__row-actions'>
                {editing && index > 0 && <view className='drawer__row-remove' data-testid={'queue-up-' + index} accessibility-element={true} accessibility-traits='button' accessibility-label={out('moveUp')} bindtap={() => usePlayerStore.getState().reorderPlaylist(index, index - 1)}><text className='drawer__row-remove-glyph'>↑</text></view>}
                {editing && index < playlist.length - 1 && <view className='drawer__row-remove' data-testid={'queue-down-' + index} accessibility-element={true} accessibility-traits='button' accessibility-label={out('moveDown')} bindtap={() => usePlayerStore.getState().reorderPlaylist(index, index + 2)}><text className='drawer__row-remove-glyph'>↓</text></view>}
              <view
                data-testid={'queue-remove-' + index}
                accessibility-element={true} accessibility-traits='button' accessibility-label={out('queueRemove')}
                className='drawer__row-remove'
                bindtap={() => void usePlayerStore.getState().removeFromPlaylist(index)}
              >
                <text className='drawer__row-remove-glyph'>✕</text>
              </view></view>
            </view>
          )
        })}
        <view className='drawer__spacer' style={{ height: `${(count - end) * rowHeight}px` }} />
      </view>
    </scroll-view>
  )
}
