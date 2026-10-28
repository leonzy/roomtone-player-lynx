import { expect, test } from 'vitest'
import { queueDirectory } from '../domain/queue-metadata.js'

test('NAS paths show the containing subdirectory without the filename', () => {
  expect(queueDirectory({ filePath: 'music/Artist/Album/song.flac' })).toBe('Artist/Album')
  expect(queueDirectory({ filePath: '/app/music/Artist/Album/song.flac' })).toBe('Artist/Album')
})
test('Windows separators and missing paths are handled', () => {
  expect(queueDirectory({ filePath: 'C:\\Music\\Artist\\song.mp3' })).toBe('C:/Music/Artist')
  expect(queueDirectory({ filePath: undefined })).toBe('')
  expect(queueDirectory({ filePath: 'song.mp3' })).toBe('')
  expect(queueDirectory({ filePath: 'https://example.com/music/song.mp3' })).toBe('')
})
