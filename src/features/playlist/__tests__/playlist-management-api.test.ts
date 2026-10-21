import { expect, test } from 'vitest'

import { HttpClient, type TransportRequest } from '../../../core/network/http-client.js'
import { PlaylistApi } from '../api/playlist-api.js'
import { SongsApi } from '../../library/api/songs-api.js'

test('permanent sorts use the server action endpoint; file deletion remains an explicit opt-in', async () => {
  const requests: TransportRequest[] = []
  const client = new HttpClient({
    getBaseUrl: () => 'https://music.test',
    getBasePath: () => '',
    transport: async (request) => {
      requests.push(request)
      return { status: 200, body: '{}', headers: {} }
    },
  })
  const playlists = new PlaylistApi(client)
  const songs = new SongsApi(client)
  for (const action of ['name_asc', 'name_desc', 'number_prefix', 'shuffle'] as const) {
    await playlists.sortPlaylistSongs(7, action)
    expect(requests.at(-1)).toMatchObject({
      method: 'POST',
      url: 'https://music.test/api/v1/playlists/7/songs/sort',
      body: JSON.stringify({ action }),
    })
  }
  await songs.deleteSong(4)
  expect(requests.at(-1)?.url).toBe('https://music.test/api/v1/songs/4')
  await songs.deleteSong(4, { deleteFiles: true })
  expect(requests.at(-1)?.url).toBe('https://music.test/api/v1/songs/4?delete_files=true')
  await playlists.deletePlaylist(7)
  expect(requests.at(-1)?.url).toBe('https://music.test/api/v1/playlists/7')
  await playlists.deletePlaylist(7, { deleteSongs: true })
  expect(requests.at(-1)?.url).toBe('https://music.test/api/v1/playlists/7?delete_songs=true')
  await playlists.batchDeletePlaylists({ ids: [7, 8], deleteSongs: true })
  expect(requests.at(-1)).toMatchObject({ method: 'POST', url: 'https://music.test/api/v1/playlists/batch-delete', body: JSON.stringify({ ids: [7, 8], delete_songs: true }) })
  await playlists.batchDeletePlaylists({ ids: [7, 8] })
  expect(JSON.parse(requests.at(-1)!.body!)).toEqual({ ids: [7, 8], delete_songs: false })
})
