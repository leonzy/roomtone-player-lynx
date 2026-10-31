import { getQueryClient, type QueryClient } from '../../../lib/query/index.js'
import type { Song } from '../../../models/song.js'
import { patchSongMetadata } from '../../../models/song-metadata.js'
import { outputKey, updateOutputSong } from '../../output/runtime.js'

const songQueryPrefixes = ['library', 'playlist', 'song-tags', 'play-history']

export function applySongMetadata(song: Song, client: QueryClient = getQueryClient()) {
  for (const prefix of songQueryPrefixes) client.setQueriesData({ queryKey: [prefix] }, data => patchSongMetadata(data, song))
  updateOutputSong(song)
}

export async function publishSavedSong(song: Song, client: QueryClient = getQueryClient()) {
  await Promise.all([
    ...songQueryPrefixes.map(prefix => client.cancelQueries({ queryKey: [prefix] })),
    client.cancelQueries({ queryKey: [...outputKey(), 'songs'] }),
  ])
  applySongMetadata(song, client)
  for (const prefix of songQueryPrefixes) void client.invalidateQueries({ queryKey: [prefix] })
}
