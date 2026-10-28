import type { OutputDevice, OutputGroup } from './api.js'

// Local clients disappear from the picker when their page disconnects. Keep
// persisted devices in management so names, settings and queues survive return.
export function selectableZones(groups: OutputGroup[], players: OutputDevice[]) {
  return groups.filter(group => group.members.some(member => {
    const player = players.find(p => p.ID === member.player_id)
    return player && (player.Kind !== 'local' || player.Online)
  }))
}

export interface GroupChoice {
  id: string
  playerIds: string[]
  names: string[]
  local: boolean
  existing: boolean
  unavailable: boolean
  incompatible: boolean
}
/** The current zone is the anchor. Other grouped zones are selected as a unit. */
export function groupChoices(source: OutputGroup, groups: OutputGroup[], players: OutputDevice[]): GroupChoice[] {
  const byId = new Map(players.map(p => [p.ID, p]))
  const exact = ['exact', 'precise'].includes(source.sync_tier)
  const make = (id: string, ids: string[], existing: boolean): GroupChoice => ({
    id, playerIds: ids, names: ids.map(id => byId.get(id)?.Name ?? id), existing,
    local: ids.length === 1 && byId.get(ids[0]!)?.Kind === 'local',
    unavailable: !existing && ids.some(id => !byId.get(id)?.Online || byId.get(id)?.standby),
    incompatible: !existing && exact && ids.some(id => !['exact', 'precise'].includes(byId.get(id)?.Caps.sync_tier ?? 'none')),
  })
  const choices = source.members.filter(m => m.player_id !== source.master_id).map(m => make(m.player_id, [m.player_id], true))
  for (const group of groups) {
    if (group.id === source.id) continue
    const ids = group.members.map(m => m.player_id).filter(id => id !== source.master_id)
    if (ids.length) choices.push(make(group.id, ids, false))
  }
  return choices
}
export function toggleGroupChoice(selected: string[], choice: GroupChoice, anchor: string): string[] {
  if (choice.unavailable || choice.incompatible) return selected
  const next = new Set(selected)
  if (choice.playerIds.every(id => next.has(id))) choice.playerIds.forEach(id => next.delete(id))
  else choice.playerIds.forEach(id => next.add(id))
  next.add(anchor)
  return [...next]
}
export function groupChanges(source: OutputGroup, selected: string[]) {
  const next = new Set([source.master_id, ...selected])
  return {
    add: [...next].filter(id => !source.members.some(m => m.player_id === id)),
    remove: source.members.map(m => m.player_id).filter(id => id !== source.master_id && !next.has(id)),
  }
}
