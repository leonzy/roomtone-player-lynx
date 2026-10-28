import type { AnchorMeasurement } from '../../../shared/ui/anchored-overlay.js'
import { createStore } from 'zustand/vanilla'
import { createQueueAppender, prepareCollectionShuffle } from '../../output/runtime.js'
import type { PlaybackContext } from '../domain/playback-context.js'
import { collectQueueSongs } from './collection-queue.js'
import { playAllWithBackgroundFill, type PlayAllPage } from './play-all.js'

type FetchPage = (offset: number, limit: number) => Promise<PlayAllPage>
type Request = { anchor?: AnchorMeasurement; fetch: FetchPage; context?: PlaybackContext; resolve(value: boolean): void; reject(error: unknown): void; append: ReturnType<typeof createQueueAppender>; next: ReturnType<typeof createQueueAppender> }
export const collectionPlayback = createStore<{ request: Request | null }>(() => ({ request: null }))

/** Every collection play shortcut offers the same actions before touching playback. */
export function chooseCollectionPlayback(fetch: FetchPage, context?: PlaybackContext, anchor?: AnchorMeasurement): Promise<boolean> {
  cancelCollectionPlayback()
  return new Promise((resolve, reject) => collectionPlayback.setState({ request: {
    fetch, context, anchor, resolve, reject,
    append: createQueueAppender('end'), next: createQueueAppender('next'),
  } }))
}

export function cancelCollectionPlayback() {
  const request = collectionPlayback.getState().request
  collectionPlayback.setState({ request: null })
  // Existing callers reserve false for an empty collection, not cancellation.
  request?.resolve(true)
}

export async function selectCollectionPlayback(action: string) {
  const request = collectionPlayback.getState().request
  if (!request) return
  collectionPlayback.setState({ request: null })
  try {
    if (action === 'play' || action === 'shuffle') {
      if (action === 'shuffle') await prepareCollectionShuffle()
      request.resolve(await playAllWithBackgroundFill(request.fetch, request.context))
    } else {
      const first = await request.fetch(0, 200)
      const songs = await collectQueueSongs(first.songs, first.total, async (offset, limit) => (await request.fetch(offset, limit)).songs)
      await (action === 'next' ? request.next : request.append)(songs)
      request.resolve(songs.length > 0)
    }
  } catch (error) { request.reject(error) }
}
