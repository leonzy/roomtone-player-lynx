import { expect, test } from 'vitest'
import type { Song } from '../../../models/song.js'
import { QueueNavigation } from '../domain/queue-navigation.js'
import { queueProgress } from '../domain/queue-progress.js'

const songs = Array.from({ length: 50 }, (_, id) => ({ id, duration: 10 } as Song))

test('random position does not count unplayed earlier entries as played', () => {
  expect(queueProgress(songs, 45).remaining).toBe(50)
  expect(queueProgress(songs, 45, [2, 10, 45]).remaining).toBe(48)
  expect(queueProgress(songs, 45, [2, 10, 45]).duration).toBe(480)
  expect([...queueProgress(songs, 45, [2, 10, 45]).played]).toEqual([2, 10])
})

test('replays invalid indices and repeated songs never double count', () => {
  expect(queueProgress(songs, 10, [2, 2, -1, 100, 1.5, 10]).remaining).toBe(49)
  const duplicates = [songs[0], songs[0], songs[0]]
  expect(queueProgress(duplicates, 1, [0, 1]).remaining).toBe(2)
  expect(queueProgress([], -1).remaining).toBe(0)
})

test('actual history survives shuffle rounds, mode switches and remapping; failures do not count', () => {
  const navigation = new QueueNavigation()
  navigation.reset('random')
  navigation.markPlayed(45)
  navigation.markPlayed(2)
  navigation.markFailed(3)
  navigation.reset('order', true)
  expect(navigation.playedIndices).toEqual([45, 2])
  navigation.remap(new Map([[45, 0], [2, 1]]))
  expect(navigation.playedIndices).toEqual([0, 1])
  navigation.reset('order')
  expect(navigation.playedIndices).toEqual([])
})
