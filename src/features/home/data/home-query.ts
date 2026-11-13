import { useInfiniteQuery } from '@tanstack/react-query'
import type { PlaylistType } from '../../../core/config/constants.js'
import { getPlaylistApi } from '../../playlist/api/index.js'

/** One bounded random preview; never paginate an unstable random ordering. */
export function useHomePlaylists(type: PlaylistType, options: { enabled?: boolean; limit?: number; batch?: number; avoidIds?: number[]; excludeIds?: number[] } = {}) {
  const limit = Math.max(1, Math.min(200, options.limit ?? 20))
  const filters = { type, random: true, avoidIds: options.avoidIds, excludeIds: options.excludeIds }
  return useInfiniteQuery({
    queryKey: ['playlist', 'list', 'home', filters, limit, options.batch ?? 0],
    initialPageParam: 0,
    queryFn: () => getPlaylistApi().getPlaylists(filters, { limit, offset: 0 }),
    getNextPageParam: () => undefined,
    placeholderData: previous => previous,
    staleTime: 120_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
  })
}
