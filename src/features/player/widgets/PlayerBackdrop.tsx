import { useState } from '@lynx-js/react'
import { useSurfaceAppearance } from '../../../shared/theme/surface-appearance.js'
import './PlayerBackdrop.css'

export interface PlayerBackdropProps {
  /** Same authenticated cover URL as the visible artwork; reuse the host image cache. */
  coverUrl?: string
}

/** Local load state is reset by the cover URL key, isolating late old-song events. */
function CoverWash({ coverUrl }: { coverUrl: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  return (
    <>
      {status !== 'failed' ? (
        <view className='player-backdrop__vivid' style={{ opacity: status === 'ready' ? 1 : 0 }}>
          <image
            className='player-backdrop__img'
            src={coverUrl}
            mode='aspectFill'
            bindload={() => setStatus('ready')}
            binderror={() => setStatus('failed')}
          />
        </view>
      ) : null}
      {status === 'ready' ? <view className='player-backdrop__scrim' /> : null}
    </>
  )
}

export function PlayerBackdrop({ coverUrl }: PlayerBackdropProps) {
  const { increaseContrast, reduceTransparency } = useSurfaceAppearance()
  return (
    <view className='player-backdrop' data-testid='player-backdrop' id='songloft-backdrop' flatten={false}>
      {coverUrl && !increaseContrast && !reduceTransparency
        ? <CoverWash key={coverUrl} coverUrl={coverUrl} /> : null}
    </view>
  )
}
