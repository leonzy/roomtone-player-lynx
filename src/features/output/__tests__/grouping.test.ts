import { expect, test } from 'vitest'
import type { OutputDevice, OutputGroup } from '../api.js'
import { groupChanges, groupChannelChanges, groupChoices, toggleGroupChoice, selectableZones } from '../grouping.js'

test('disconnected browsers and network bridges disappear from playback choices', () => {
  const players = [ { ...player('old', false), Kind: 'local' }, { ...player('current'), Kind: 'local' }, player('speaker', false) ]
  const groups = [group('old-browser', ['old']), group('current-browser', ['current']), group('network', ['speaker'])]
  expect(selectableZones(groups, players).map(g => g.id)).toEqual(['current-browser'])
  expect(groups).toHaveLength(3)
})

const player = (id: string, online = true, tier = 'exact') => ({ ID: id, Name: `Room ${id}`, Kind: 'raop', Online: online, Caps: { sync_tier: tier } }) as OutputDevice
const group = (id: string, ids: string[]) => ({ id, name: id, master_id: ids[0]!, members: ids.map(player_id => ({ player_id })), sync_tier: 'exact' }) as OutputGroup

test('online standby speakers remain visible but cannot join until awakened', () => {
  const source = group('source', ['A'])
  const sleeper = { ...player('B'), standby: true }
  const [choice] = groupChoices(source, [source, group('sleeping', ['B'])], [player('A'), sleeper])
  expect(choice?.names).toEqual(['Room B'])
  expect(choice?.unavailable).toBe(true)
  expect(toggleGroupChoice(['A'], choice!, 'A')).toEqual(['A'])
})

test('the current A is fixed above the choices and can never be removed by a draft', () => {
  const source = group('source', ['A', 'B'])
  const choices = groupChoices(source, [source, group('other', ['C'])], ['A', 'B', 'C'].map(id => player(id)))
  expect(choices.map(c => c.playerIds)).toEqual([['B'], ['C']])
  expect(choices[0]!.existing).toBe(true)
  expect(groupChanges(source, [])).toEqual({ add: [], remove: ['B'] })
  expect(toggleGroupChoice(['A', 'B'], choices[0]!, 'A')).toEqual(['A'])
})
test('selecting an existing B+C zone adds both members to A and unchecking removes the entire choice', () => {
  const source = group('source', ['A'])
  const [choice] = groupChoices(source, [source, group('BC', ['B', 'C'])], ['A', 'B', 'C'].map(id => player(id)))
  expect(choice!.names).toEqual(['Room B', 'Room C'])
  const selected = toggleGroupChoice(['A'], choice!, 'A')
  expect(groupChanges(source, selected)).toEqual({ add: ['B', 'C'], remove: [] })
  expect(toggleGroupChoice(selected, choice!, 'A')).toEqual(['A'])
})
test('unavailable or incompatible zones cannot be added; an offline existing member can be removed', () => {
  const source = group('source', ['A', 'B'])
  const choices = groupChoices(source, [source, group('mixed', ['C', 'D']), group('dlna', ['E']), group('offline', ['F'])], [player('A'), player('B', false), player('C'), player('D', false), player('E', true, 'aligned'), player('F', false)])
  expect(choices.map(c => c.id)).toEqual(['B', 'mixed', 'dlna', 'offline'])
  expect(toggleGroupChoice(['A', 'B'], choices[0]!, 'A')).toEqual(['A'])
  expect(choices[1]!.unavailable).toBe(true)
  expect(choices[2]!.incompatible).toBe(true)
  expect(toggleGroupChoice(['A'], choices[1]!, 'A')).toEqual(['A'])
  expect(toggleGroupChoice(['A'], choices[2]!, 'A')).toEqual(['A'])
  expect(choices[3]!.names).toEqual(['Room F'])
  expect(choices[3]!.unavailable).toBe(true)
})

test('grouping is stereo by default and never assigns a stereo pair automatically', () => {
  const source = group('source', ['A'])
  expect(groupChannelChanges(source, ['A', 'B'], {})).toEqual([])
  expect(groupChannelChanges(source, ['A', 'B'], { A: 'stereo', B: 'stereo' })).toEqual([])
  expect(groupChannelChanges(source, ['A', 'B'], { A: 'left', B: 'right' })).toEqual([{ id: 'A', mode: 'left' }, { id: 'B', mode: 'right' }])
})
test('untouched existing channel assignments are preserved and solo grouping sends no role', () => {
  const source = group('source', ['A', 'B'])
  source.members[0]!.channel_mode = 'left'
  source.members[1]!.channel_mode = 'right'
  expect(groupChannelChanges(source, ['A', 'B', 'C'], { A: 'left', B: 'right' })).toEqual([])
  expect(groupChannelChanges(source, ['A'], { A: 'left' })).toEqual([])
  expect(groupChannelChanges(source, ['A', 'B'], { A: 'stereo', B: 'right' })).toEqual([{ id: 'A', mode: 'stereo' }])
})
