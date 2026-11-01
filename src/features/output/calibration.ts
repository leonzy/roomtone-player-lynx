import type { OutputGroup } from './api.js'

export const MIN_DELAY_MS = -2000
export const MAX_DELAY_MS = 2000

export function delayValue(raw: string): number | null {
  if (!/^-?\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= MIN_DELAY_MS && value <= MAX_DELAY_MS ? value : null
}

export function calibrationMembers(group: OutputGroup): string {
  return group.members.map(m => m.player_id).sort().join('\n')
}

/** Re-read before saving: preserve current volume offsets and reject stale edits. */
export async function saveCalibration(options: {
  original: OutputGroup
  draft: Record<string, string>
  read(): Promise<OutputGroup | undefined>
  patch(id: string, values: { delay_ms: number; volume_offset: number }): Promise<unknown>
  changedMessage: string
  invalidMessage: string
}): Promise<void> {
  const { original, draft, read, patch } = options
  const values = original.members.map(m => ({ member: m, value: delayValue(draft[m.player_id] ?? '') }))
  if (values.some(v => v.value == null)) throw new Error(options.invalidMessage)
  const current = await read()
  if (!current || calibrationMembers(current) !== calibrationMembers(original)) throw new Error(options.changedMessage)
  // Check all edited fields before the first write. Never overwrite another client's calibration.
  for (const { member, value } of values) {
    const latest = current.members.find(m => m.player_id === member.player_id)!
    if (value !== member.delay_ms && latest.delay_ms !== member.delay_ms && latest.delay_ms !== value) throw new Error(options.changedMessage)
  }
  for (const { member, value } of values) {
    if (value === member.delay_ms) continue
    const latest = current.members.find(m => m.player_id === member.player_id)!
    await patch(member.player_id, { delay_ms: value!, volume_offset: latest.volume_offset })
  }
}
