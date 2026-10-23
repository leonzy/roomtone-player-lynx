import { useTranslation } from 'react-i18next'

import { useBackHandler } from '../../../shared/nav/use-back-handler.js'
import { DOCKED_POSITION, placePanel } from '../../../shared/ui/anchored-overlay.js'
import { BackdropBlur } from '../../../shared/ui/BackdropBlur.js'
import { useSongRowOverlays } from '../../../shared/ui/song-row-overlays.js'
import { VolumeControl } from './VolumeControl.js'
import '../../../shared/ui/overlay-motion.css'
import '../../../shared/ui/PopoverMenu.css'
import './MiniPlayerVolumePanel.css'

/**
 * Volume popover for the mini player, mounted at the root (`SongRowOverlays`)
 * rather than inside the capsule: `.mini-player` sets `overflow: hidden`, so an
 * in-tree panel would be clipped to the 48px row.
 *
 * Opens above the measured trigger, right-aligned. The full player's volume
 * popover uses the same {@link VolumeControl}, so mute memory and the
 * `0..100 ↔ 0..1` conversion stay in one place.
 */
export function MiniPlayerVolumePanel() {
  const { t } = useTranslation()
  const miniVolume = useSongRowOverlays((s) => s.miniVolume)
  const close = useSongRowOverlays((s) => s.closeMiniVolume)

  useBackHandler(miniVolume != null, () => {
    close()
    return true
  })

  if (miniVolume == null) return null

  const position = miniVolume.anchor != null
    ? placePanel(miniVolume.anchor.anchor, miniVolume.anchor.viewport, 'top-end')
    : DOCKED_POSITION

  return (
    <>
      <view
        className='mini-volume__backdrop'
        bindtap={close}
        data-testid='mini-volume-backdrop'
      />
      <view
        className='popover-menu popover-panel mini-volume-panel overlay--enter-scale'
        style={position}
        data-testid='mini-volume-panel'
      >
        <BackdropBlur className='ui-backdrop-blur--panel' />
        <view className='mini-volume-panel__content'>
          <text className='mini-volume-panel__label'>{t('player.volume')}</text>
          <VolumeControl />
        </view>
      </view>
    </>
  )
}
