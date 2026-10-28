import { useSyncExternalStore } from '@lynx-js/react'
import { GlobalMenu } from '../../../shared/ui/GlobalMenu.js'
import { useOutputText } from '../../output/text.js'
import { collectionPlayback, cancelCollectionPlayback, selectCollectionPlayback } from '../data/collection-playback.js'

export function CollectionActionMenu() {
  const state = useSyncExternalStore(collectionPlayback.subscribe, collectionPlayback.getState)
  const out = useOutputText()
  return <GlobalMenu anchor={state.request?.anchor} fallbackPosition={{ right: '16px', top: '64px', maxWidth: '260px', maxHeight: '60%' }} show={state.request !== null} onClose={cancelCollectionPlayback} testId='collection-action-menu' items={[
    { key: 'play', label: out('playNow'), icon: 'play' },
    { key: 'shuffle', label: out('queueRandom'), icon: 'shuffle' },
    { key: 'next', label: out('next'), icon: 'skip-next' },
    { key: 'end', label: out('appendQueue'), icon: 'queue' },
  ]} onSelect={key => { void selectCollectionPlayback(key) }} />
}
