import '@testing-library/jest-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'

import type { Song } from '../../../models/song.js'
import { useToastStore } from '../../../shared/ui/toast-store.js'

/**
 * The playlist-side song picker — the Lynx counterpart of the Flutter
 * `SongPickerModal`. Queries are stood in (a real infinite query needs a
 * provider and a transport); what is pinned here is the exclusion set
 * (already-added songs must never be offered), the type filter, the two add
 * outcomes and the sheet staying open on failure.
 */

const { songsHolder, idsHolder, addHolder, addSpy } = vi.hoisted(() => ({
  songsHolder: { query: {} as Record<string, unknown> },
  idsHolder: { query: {} as Record<string, unknown> },
  addHolder: { mutation: {} as Record<string, unknown> },
  addSpy: vi.fn(),
}))

vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)
vi.mock('@lynx-js/lynx-ui-input', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockLynxUiInput(),
)
// `playlist-query.ts` imports both hooks; the sheet itself uses `useQuery`.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => idsHolder.query,
  useInfiniteQuery: () => songsHolder.query,
}))
vi.mock('../../library/data/songs-query.js', () => ({
  useSongsInfiniteQuery: () => songsHolder.query,
}))
vi.mock('../data/playlist-mutations.js', () => ({
  useAddSongsMutation: () => addHolder.mutation,
}))
vi.mock('../api/index.js', () => ({
  getPlaylistApi: () => ({ getPlaylistSongIds: vi.fn() }),
}))

const { AddSongsToPlaylistSheet } = await import('../widgets/AddSongsToPlaylistSheet.js')

function makeSong(id: number, over: Partial<Song> = {}): Song {
  return {
    id,
    type: 'local',
    title: `Song ${id}`,
    artist: `Artist ${id}`,
    duration: 200,
    addedAt: '',
    updatedAt: '',
    ...over,
  } as Song
}

/** A settled songs page with no further pages. */
function songsResult(songs: Song[], over: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ songs, total: songs.length }] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...over,
  }
}

function idsResult(ids: number[], over: Record<string, unknown> = {}) {
  return { data: ids, isPending: false, isError: false, refetch: vi.fn(), ...over }
}

function addMutation(over: Record<string, unknown> = {}) {
  return { isPending: false, mutateAsync: addSpy, ...over }
}

function renderSheet(overrides: {
  playlistType?: 'normal' | 'radio'
  onClose?: () => void
} = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  render(
    <AddSongsToPlaylistSheet
      playlistId={7}
      playlistType={overrides.playlistType ?? 'normal'}
      onClose={onClose}
    />,
  )
  return { onClose, ...getQueriesForElement(elementTree.root!) }
}

beforeEach(() => {
  songsHolder.query = songsResult([makeSong(1), makeSong(2), makeSong(3)])
  idsHolder.query = idsResult([])
  addSpy.mockResolvedValue({ added: 1, skipped: 0 })
  addHolder.mutation = addMutation()
})

afterEach(() => {
  vi.clearAllMocks()
  useToastStore.getState().clearToast()
})

test('songs already in the playlist are not offered', () => {
  idsHolder.query = idsResult([2])
  const { queryByText } = renderSheet()
  expect(queryByText('Song 1')).toBeInTheDocument()
  expect(queryByText('Song 2')).not.toBeInTheDocument()
  expect(queryByText('Song 3')).toBeInTheDocument()
})

test('a normal playlist never offers radio songs', () => {
  songsHolder.query = songsResult([
    makeSong(1),
    makeSong(2, { type: 'radio' }),
    makeSong(3, { type: 'remote' }),
  ])
  const { queryByText } = renderSheet({ playlistType: 'normal' })
  expect(queryByText('Song 1')).toBeInTheDocument()
  expect(queryByText('Song 2')).not.toBeInTheDocument()
  expect(queryByText('Song 3')).toBeInTheDocument()
})

test('a radio playlist only offers radio songs', () => {
  songsHolder.query = songsResult([
    makeSong(1),
    makeSong(2, { type: 'radio' }),
  ])
  const { queryByText } = renderSheet({ playlistType: 'radio' })
  expect(queryByText('Song 1')).not.toBeInTheDocument()
  expect(queryByText('Song 2')).toBeInTheDocument()
})

test('the confirm button carries the selection count and adds them in one request', async () => {
  addSpy.mockResolvedValue({ added: 2, skipped: 0 })
  const { getByText, getByTestId, onClose } = renderSheet()

  fireEvent.tap(getByText('Song 1'), {})
  fireEvent.tap(getByText('Song 3'), {})
  expect(getByText('Add (2)')).toBeInTheDocument()

  fireEvent.tap(getByTestId('add-songs-confirm'), {})
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })

  expect(addSpy).toHaveBeenCalledWith([1, 3])
  expect(useToastStore.getState().toast?.tone).toBe('success')
  expect(useToastStore.getState().toast?.text).toBe('Added 2 songs')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('skipped songs get their own message', async () => {
  addSpy.mockResolvedValue({ added: 1, skipped: 2 })
  const { getByText, getByTestId } = renderSheet()

  fireEvent.tap(getByText('Song 1'), {})
  fireEvent.tap(getByTestId('add-songs-confirm'), {})
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })

  expect(useToastStore.getState().toast?.text).toContain('skipped 2')
})

test('a failed add reports the error and leaves the sheet open', async () => {
  addSpy.mockRejectedValue(new Error('boom'))
  const { getByText, getByTestId, onClose } = renderSheet()

  fireEvent.tap(getByText('Song 1'), {})
  fireEvent.tap(getByTestId('add-songs-confirm'), {})
  await act(async () => { await Promise.resolve() })
  await act(async () => { await Promise.resolve() })

  expect(useToastStore.getState().toast?.tone).toBe('error')
  expect(useToastStore.getState().toast?.text).toBe('boom')
  expect(onClose).not.toHaveBeenCalled()
})

test('an empty result says there is nothing to add', () => {
  idsHolder.query = idsResult([1, 2, 3])
  const { getByTestId, queryByText } = renderSheet()
  expect(getByTestId('add-songs-empty')).toBeInTheDocument()
  expect(queryByText('Song 1')).not.toBeInTheDocument()
})

test('the backdrop closes the sheet', () => {
  const { getByTestId, onClose } = renderSheet()
  fireEvent.tap(getByTestId('add-songs-backdrop'), {})
  expect(onClose).toHaveBeenCalledTimes(1)
})
