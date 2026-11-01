import { useState } from '@lynx-js/react'
import { Input } from '@lynx-js/lynx-ui-input'
import { SliderRoot, SliderTrack, SliderIndicator, SliderThumb } from '@lynx-js/lynx-ui-slider'
import { Icon, ICON_COLORS } from '../../shared/ui/Icon.js'
import { outputApi, type OutputDevice, type OutputGroup } from './api.js'
import { outputAction, openOutputPanel, refreshOutputs, useZoneState } from './runtime.js'
import { useOutputText } from './text.js'
import { delayValue, saveCalibration, MIN_DELAY_MS, MAX_DELAY_MS } from './calibration.js'

export function DelayCalibration({ group, players }: { group: OutputGroup; players: OutputDevice[] }) {
  const out = useOutputText(), busy = useZoneState(s => s.busy)
  const [original, setOriginal] = useState(group)
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(group.members.map(m => [m.player_id, String(m.delay_ms)])))
  const [saved, setSaved] = useState(false)
  const changed = original.members.some(m => draft[m.player_id] !== String(m.delay_ms))
  const valid = original.members.every(m => delayValue(draft[m.player_id] ?? '') != null)
  const set = (id: string, value: string) => { if (busy) return; setSaved(false); setDraft(d => ({ ...d, [id]: value })) }
  const save = () => void outputAction(async () => {
    try {
      await saveCalibration({ original, draft,
        read: async () => (await outputApi.outputs()).groups.find(g => g.id === group.id),
        patch: (id, values) => outputApi.member(group.id, id, 'PATCH', values),
        changedMessage: out('calibrationChanged'), invalidMessage: out('calibrationInvalid'),
      })
      const latest = (await outputApi.outputs()).groups.find(g => g.id === group.id)
      if (!latest) throw new Error(out('calibrationChanged'))
      setOriginal(latest)
      setDraft(Object.fromEntries(latest.members.map(m => [m.player_id, String(m.delay_ms)])))
      setSaved(true)
    } finally { await refreshOutputs().catch(() => {}) }
  })
  return <view className='output-calibration'>
    <text className='output-calibration-intro'>{out('calibrationHint')}</text>
    <view className='output-calibration-guide'><text>{out('calibrationGuide')}</text><text className='output-device-detail'>{out('calibrationApply')}</text></view>
    {original.members.map(m => {
      const device = players.find(p => p.ID === m.player_id), raw = draft[m.player_id] ?? '', value = delayValue(raw)
      const step = (by: number) => set(m.player_id, String(Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, (value ?? m.delay_ms) + by))))
      return <view key={m.player_id} className='output-calibration-card' data-testid={`calibration-member-${m.player_id}`}>
        <view className='output-row'><Icon name={device?.Kind === 'local' ? 'computer' : 'speaker'} size={25} color={ICON_COLORS.content2} /><view className='output-device-copy'><text className='output-device-name'>{device?.Name ?? m.player_id}</text><text className='output-device-detail'>{device?.Kind === 'raop' ? 'AirPlay' : device?.Kind === 'local' ? 'Web' : device?.Kind?.toUpperCase()}</text></view>
          <view className='output-button' bindtap={busy ? undefined : () => set(m.player_id, '0')} accessibility-element={true} accessibility-traits='button' accessibility-label={out('calibrationReset')}><text>{out('calibrationReset')}</text></view>
        </view>
        <view className='output-calibration-value'><Input className='output-input' type='number' value={raw} onInput={v => set(m.player_id, v)} placeholder='0' /><text>ms</text><text className='output-device-detail'>{value == null ? out('calibrationInvalid') : out(value > 0 ? 'calibrationLater' : value < 0 ? 'calibrationEarlier' : 'calibrationZero')}</text></view>
        <SliderRoot className='output-slider' value={((value ?? m.delay_ms) + 2000) / 4000} step={10 / 4000} disabled={busy} onValueChange={v => set(m.player_id, String(Math.round((v * 4000 - 2000) / 10) * 10))}><SliderTrack className='output-slider-track'><SliderIndicator className='output-slider-fill' /><SliderThumb className='output-slider-thumb-wrap'><view className='output-slider-thumb' /></SliderThumb></SliderTrack></SliderRoot>
        <view className='output-calibration-scale'><text>−2000 ms</text><text>0</text><text>+2000 ms</text></view>
        <view className='output-calibration-steps'>{[-50, -10, 10, 50].map(by => <view key={by} className={`output-button${busy ? ' output-disabled' : ''}`} bindtap={busy ? undefined : () => step(by)} accessibility-element={true} accessibility-traits='button' accessibility-label={`${by > 0 ? '+' : ''}${by} ms`}><text>{by > 0 ? '+' : ''}{by} ms</text></view>)}</view>
      </view>
    })}
    {saved && <text className='output-calibration-saved'>{out('calibrationSaved')}</text>}
    <view className='output-group-actions'><view className='output-group-save'><view className={`output-button${busy || !changed || !valid ? ' output-disabled' : ''}`} bindtap={busy || !changed || !valid ? undefined : save} accessibility-element={true} accessibility-traits='button' accessibility-label={out('save')} data-testid='calibration-save'><text>{out(busy ? 'groupSaving' : 'save')}</text></view></view><view className='output-group-cancel'><view className='output-button' bindtap={busy ? undefined : () => openOutputPanel('settings')}><text>{out('cancel')}</text></view></view></view>
  </view>
}
