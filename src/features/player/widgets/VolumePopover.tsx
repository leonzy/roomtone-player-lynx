import { useTranslation } from 'react-i18next'

import { Icon, ICON_COLORS } from '../../../shared/ui/Icon.js'
import { useTapAnchor } from '../../../shared/ui/anchored-overlay.js'
import { openOutputPanel } from '../../output/runtime.js'
import { isMuted, usePlayerStore } from '../store/index.js'

/**
 * Volume behind a tap, as a slider in a popover.
 *
 * It used to be a permanently-visible slider row at the foot of the player. Flutter
 * puts it in the tool row instead, and that row is where the vertical space it was
 * occupying went: the transport controls and the progress bar are what the screen is
 * for, and volume is usually the device's hardware buttons' job anyway.
 *
 * The panel reuses {@link VolumeControl} verbatim, so mute-toggle and slider behaviour
 * (including the 0..100 ↔ 0..1 conversion) stays in one place.
 */
export function VolumePopover({ slot }: { slot: number }) {
  const { t } = useTranslation()
  const anchor = useTapAnchor()
  const muted = usePlayerStore(isMuted)

  return (
    <view className='player-tools__btn' id={anchor.anchorId} accessibility-element={true} accessibility-label={t('player.volume')} bindtap={() => anchor.measure(m => openOutputPanel('volume', m ?? undefined))}>
        <view
          className='player-tools__hit'
          style={{ width: `${slot}px`, height: `${slot}px` }}
          data-testid='volume-btn'
        >
          <Icon
            name={muted ? 'volume-mute' : 'volume'}
            size={20}
            color={ICON_COLORS.content}
          />
        </view>
    </view>
  )
}
