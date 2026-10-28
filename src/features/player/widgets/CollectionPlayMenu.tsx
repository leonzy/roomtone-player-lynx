import { useState } from '@lynx-js/react'
import { PopoverMenu } from '../../../shared/ui/PopoverMenu.js'
import { Icon, ICON_COLORS } from '../../../shared/ui/Icon.js'
import { useOutputText } from '../../output/text.js'

export type CollectionAction = 'shuffle' | 'next' | 'end'
export function CollectionPlayMenu({ className, enabled, onPlay, onAction }: { className: string; enabled: boolean; onPlay(): void; onAction(action: CollectionAction): void }) {
  const [show, setShow] = useState(false), out = useOutputText()
  if (!enabled) return null
  return <PopoverMenu show={show} onShowChange={setShow} placement='bottom-start' triggerClassName={className} triggerAccessibilityLabel={out('playOptions')} trigger={<view data-testid='collection-play-options'><Icon name='chevron-down' size={16} color={ICON_COLORS.content2} /></view>} items={[
    { key: 'play', label: out('playNow'), icon: 'play' },
    { key: 'shuffle', label: out('queueRandom'), icon: 'shuffle' },
    { key: 'next', label: out('next'), icon: 'skip-next' },
    { key: 'end', label: out('appendQueue'), icon: 'queue' },
  ]} onSelect={key => { setShow(false); if (key === 'play') onPlay(); else onAction(key as CollectionAction) }} />
}
