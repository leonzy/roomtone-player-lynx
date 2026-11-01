import { expect, test, vi } from 'vitest'
import type { OutputGroup } from '../api.js'
import { delayValue, saveCalibration } from '../calibration.js'

const group = () => ({ id: 'mixed', members: [
  { player_id: 'xiaomi', delay_ms: 0, volume_offset: 2, position: 0 },
  { player_id: 'study', delay_ms: 1000, volume_offset: -3, position: 1 },
] }) as OutputGroup
const messages = { changedMessage: 'changed', invalidMessage: 'invalid' }

test('calibration accepts only bounded integer milliseconds, including zero and negatives', () => {
  for (const raw of ['', '1.5', 'NaN', 'Infinity', '2001', '-2001', '1e3']) expect(delayValue(raw)).toBeNull()
  for (const raw of ['0', '-2000', '2000', ' 1010 ']) expect(delayValue(raw)).toBe(Number(raw))
})
test('save writes changed speakers only and preserves the latest volume offset', async () => {
  const original = group(), latest = group(), patch = vi.fn().mockResolvedValue({})
  latest.members[1]!.volume_offset = 7
  await saveCalibration({ ...messages, original, draft: { xiaomi: '0', study: '1050' }, read: async () => latest, patch })
  expect(patch.mock.calls).toEqual([['study', { delay_ms: 1050, volume_offset: 7 }]])
})
test('membership changes and conflicting edits reject before any write', async () => {
  for (const change of ['members', 'delay']) {
    const latest = group(), patch = vi.fn()
    if (change === 'members') latest.members.pop()
    else latest.members[1]!.delay_ms = 500
    await expect(saveCalibration({ ...messages, original: group(), draft: { xiaomi: '10', study: '1050' }, read: async () => latest, patch })).rejects.toThrow('changed')
    expect(patch).not.toHaveBeenCalled()
  }
})
test('invalid values cannot partially save, and server failures propagate', async () => {
  const patch = vi.fn().mockRejectedValue(new Error('disk full'))
  await expect(saveCalibration({ ...messages, original: group(), draft: { xiaomi: '10', study: 'bad' }, read: async () => group(), patch })).rejects.toThrow('invalid')
  expect(patch).not.toHaveBeenCalled()
  await expect(saveCalibration({ ...messages, original: group(), draft: { xiaomi: '0', study: '1010' }, read: async () => group(), patch })).rejects.toThrow('disk full')
})
