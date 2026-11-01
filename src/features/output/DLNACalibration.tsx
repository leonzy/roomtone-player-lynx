import { useState } from '@lynx-js/react'
import { Input } from '@lynx-js/lynx-ui-input'
import { SliderRoot, SliderTrack, SliderIndicator, SliderThumb } from '@lynx-js/lynx-ui-slider'
import { Icon, ICON_COLORS } from '../../shared/ui/Icon.js'
import { outputApi, type OutputDevice } from './api.js'
import { outputAction, openOutputPanel, useZoneState } from './runtime.js'
import { useOutputText } from './text.js'

export function parseDLNADelay(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 && value <= 2000 ? value : null
}

export function DLNACalibration({ device }: { device: OutputDevice }) {
  const out = useOutputText(), busy = useZoneState(s => s.busy)
  const [raw, setRaw] = useState(String(device.dlna_sync_delay_ms)), [saved, setSaved] = useState(false)
  const [baseline, setBaseline] = useState(device.dlna_sync_delay_ms)
  const value = parseDLNADelay(raw)
  const set = (next: string) => { if (!busy) { setRaw(next); setSaved(false) } }
  const step = (by: number) => set(String(Math.max(0, Math.min(2000, (value ?? baseline) + by))))
  const save = () => void outputAction(async () => {
    if (value == null) return
    const current = (await outputApi.outputs()).players.find(p => p.ID === device.ID)
    if (!current || (current.dlna_sync_delay_ms !== baseline && current.dlna_sync_delay_ms !== value)) throw new Error(out('calibrationChanged'))
    await outputApi.updateDevice(device.ID, { dlna_sync_delay_ms: value })
    setBaseline(value); setSaved(true)
  })
  return <view className='output-calibration'>
    <view className='output-row'><Icon name='speaker' size={30} color={ICON_COLORS.content2} /><view className='output-device-copy'><text className='output-device-name'>{device.Name}</text><text className='output-device-detail'>DLNA</text></view></view>
    <text className='output-calibration-intro'>{out('dlnaCalibrationHint')}</text>
    <view className='output-calibration-guide'><text>{out('dlnaCalibrationExample')}</text><text className='output-device-detail'>{out('dlnaCalibrationApply')}</text></view>
    <view className='output-calibration-card'>
      <text className='output-label'>{out('dlnaDelayLabel')}</text>
      <view className='output-calibration-value'><Input className='output-input' type='number' value={raw} onInput={set} placeholder='0' /><text>ms</text><text className='output-device-detail'>{value == null ? out('dlnaDelayInvalid') : out('dlnaDelayUnit')}</text></view>
      <SliderRoot className='output-slider' value={(value ?? baseline) / 2000} step={10 / 2000} disabled={busy} onValueChange={v => set(String(Math.round(v * 200) * 10))}><SliderTrack className='output-slider-track'><SliderIndicator className='output-slider-fill' /><SliderThumb className='output-slider-thumb-wrap'><view className='output-slider-thumb' /></SliderThumb></SliderTrack></SliderRoot>
      <view className='output-calibration-scale'><text>0 ms</text><text>1000 ms</text><text>2000 ms</text></view>
      <view className='output-calibration-steps'>{[-50, -10, 10, 50].map(by => <view key={by} data-testid={`calibration-step-${by}`} className={`output-button${busy ? ' output-disabled' : ''}`} bindtap={busy ? undefined : () => step(by)} accessibility-element={true} accessibility-traits='button' accessibility-label={`${by > 0 ? '+' : ''}${by} ms`}><text>{by > 0 ? '+' : ''}{by} ms</text></view>)}</view>
    </view>
    {saved && <text className='output-calibration-saved'>{out('calibrationSaved')}</text>}
    <view className='output-group-actions'><view className='output-group-save'><view className={`output-button${busy || value == null || value === baseline ? ' output-disabled' : ''}`} bindtap={busy || value == null || value === baseline ? undefined : save} accessibility-element={true} accessibility-traits='button' accessibility-label={out('save')} data-testid='calibration-save'><text>{out(busy ? 'groupSaving' : 'save')}</text></view></view><view className='output-group-cancel'><view className='output-button' bindtap={busy ? undefined : () => openOutputPanel('device:' + device.ID)}><text>{out('back')}</text></view></view></view>
  </view>
}
