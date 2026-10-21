import { buildCoverUrl } from '../../../core/network/url-helper.js'
import { getQueryClient } from '../../../lib/query/index.js'
import { getAudio } from '../../../native/audio-facade.js'
import {
  hasHomeWidgets,
  subscribeWidgetActions,
  updateHomeWidget,
  type HomeWidgetSnapshot,
  type WidgetAction,
} from '../../../native/home-widget.js'
import { useAuthStore } from '../../auth/store/index.js'
import { getFavoriteState, toggleFavoriteNonReact } from '../../library/data/favorites.js'
import { hasNext, hasPrev } from '../store/derive.js'
import { usePlayerStore } from '../store/player-store.js'
import { cachedSongIdentity } from '../domain/offline-cache.js'

export function currentHomeWidgetSnapshot(): HomeWidgetSnapshot {
  const player = usePlayerStore.getState()
  const song = player.currentSong
  const local = !!song && !!cachedSongIdentity(song)
  const visible = !!song && (useAuthStore.getState().status === 'authenticated' || local)
  const favorites = getQueryClient().getQueryData<Set<number>>(['favorites', 'songIds'])
  return {
    hasSong: visible,
    title: visible ? song.title : '',
    artist: visible ? (song.artist ?? '') : '',
    coverUrl: visible && song.coverUrl ? buildCoverUrl(song.coverUrl, song.updatedAt) : '',
    isPlaying: visible && player.isPlaying,
    isFavorite: visible && !local && (favorites?.has(song.id) ?? false),
    canNext: visible && hasNext(player),
    canPrev: visible && hasPrev(player),
  }
}

export async function performWidgetAction(action: WidgetAction): Promise<void> {
  const state = usePlayerStore.getState()
  if (!currentHomeWidgetSnapshot().hasSong || state.isAudioTrackSwitching) return
  if (action === 'toggle') await state.togglePlay()
  if (action === 'next') await state.playNext()
  if (action === 'previous') await state.playPrev()
  if (
    action === 'favorite' &&
    state.currentSong &&
    !cachedSongIdentity(state.currentSong) &&
    useAuthStore.getState().status === 'authenticated'
  ) {
    const song = state.currentSong
    const favorite = await toggleFavoriteNonReact(song.id)
    // A widget has no mounted useQuery observer. Invalidation alone therefore
    // leaves its cached heart state unchanged until the next app screen opens.
    await getFavoriteState(song.id)
    if (usePlayerStore.getState().currentSong === song) await getAudio().setFavorite(favorite)
  }
}

let stopPrevious: (() => void) | undefined
export function initializeHomeWidget(openPlayer: () => void): () => void {
  stopPrevious?.()
  if (!hasHomeWidgets()) return () => {}
  let last = ''
  let lastSong: ReturnType<typeof usePlayerStore.getState>['currentSong']
  let alive = true
  const publish = () => {
    if (!alive) return
    const snapshot = currentHomeWidgetSnapshot()
    const encoded = JSON.stringify(snapshot)
    if (encoded !== last) {
      last = encoded
      updateHomeWidget(snapshot)
    }
    const song = usePlayerStore.getState().currentSong
    const changed = song !== lastSong
    lastSong = song
    if (changed && song && snapshot.hasSong && !cachedSongIdentity(song)) {
      void getFavoriteState(song.id)
        .then(publish)
        .catch(() => {})
    }
  }
  let commands = Promise.resolve()
  const stops = [
    usePlayerStore.subscribe(publish),
    useAuthStore.subscribe(publish),
    getQueryClient()
      .getQueryCache()
      .subscribe((event) => {
        if (event.query.queryKey[0] === 'favorites') publish()
      }),
    subscribeWidgetActions((action) => {
      if (action === 'open') {
        openPlayer()
        return
      }
      commands = commands
        .then(() => (alive ? performWidgetAction(action) : undefined))
        .catch(() => {})
    }),
  ]
  publish()
  const stop = () => {
    alive = false
    stops.forEach((fn) => fn())
  }
  stopPrevious = stop
  return stop
}
