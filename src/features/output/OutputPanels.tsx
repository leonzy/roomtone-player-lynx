import { useEffect, useState, useSyncExternalStore, type ReactNode } from '@lynx-js/react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@lynx-js/lynx-ui-input'
import { SliderRoot, SliderTrack, SliderIndicator, SliderThumb } from '@lynx-js/lynx-ui-slider'
import { useBackHandler } from '../../shared/nav/use-back-handler.js'
import { Icon, ICON_COLORS } from '../../shared/ui/Icon.js'
import type { IconName } from '../../shared/ui/icons.js'
import { AppSwitch } from '../../shared/ui/AppSwitch.js'
import { BackdropBlur } from '../../shared/ui/BackdropBlur.js'
import { ModalMaterial } from '../../shared/ui/ModalMaterial.js'
import { ModalScrim } from '../../shared/ui/ModalScrim.js'
import { useTapAnchor, placePanel, pickMenuPlacement, DOCKED_POSITION } from '../../shared/ui/anchored-overlay.js'
import { usePlayerStore, useLocalPlayerStore } from '../player/store/player-store.js'
import { useAppSessionStore } from '../../store/app-session.js'
import { getQueryClient } from '../../lib/query/index.js'
import { outputApi, outputId, volumeInt, type OutputGroup, type OutputDevice, type EqProfile } from './api.js'
import { focusZone, focusedGroup, openOutputPanel, outputAction, outputKey, readOutputs, refreshOutputs, startOutputRuntime, useZoneState } from './runtime.js'
import { useOutputText } from './text.js'
import { groupChoices, groupChanges, toggleGroupChoice, selectableZones } from './grouping.js'
import '../../shared/ui/PopoverMenu.css'
import './output.css'

function Button({ children, onTap, disabled = false, testId, icon, label, selected = false }: { children: ReactNode; onTap(): void; disabled?: boolean; testId?: string; icon?: IconName; label?: string; selected?: boolean }) {
  return <view className={`output-button${disabled ? ' output-disabled' : ''}${selected ? ' output-button--selected' : ''}`} bindtap={disabled ? undefined : onTap} accessibility-element={true} accessibility-traits={disabled ? 'text' : 'button'} accessibility-label={label ?? (typeof children === 'string' ? children : undefined)} data-testid={testId}>
    {icon && <Icon name={icon} size={19} color={ICON_COLORS.content2} />}{typeof children === 'string' ? <text>{children}</text> : children}
  </view>
}
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange(value: string): void; type?: 'text' | 'number' | 'password' }) {
  return <view className='output-field'><text className='output-label'>{label}</text><Input className='output-input' type={type} value={value} onInput={onChange} placeholder={label} /></view>
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return <view className='output-row'><text className='output-label'>{label}</text><AppSwitch checked={checked} onChange={onChange} /></view>
}
function NumberField({ label, value, onChange, commitOnly = false }: { label: string; value: number; onChange(v: number): void; commitOnly?: boolean }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = (raw: string) => { if (raw.trim() && Number.isFinite(Number(raw)) && Number(raw) !== value) onChange(Number(raw)) }
  return <view className='output-field'><text className='output-label'>{label}</text><Input className='output-input' type='number' value={draft} placeholder={label} onInput={raw => { setDraft(raw); if (!commitOnly) commit(raw) }} onBlur={raw => { if (commitOnly) commit(raw) }} onConfirm={raw => { if (commitOnly) commit(raw) }} /></view>
}
function Choices({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange(v: string): void }) {
  const out = useOutputText()
  const labels: Record<string, string> = { speaker: out('iconSpeaker'), bookshelf: out('iconBookshelf'), soundbar: out('iconSoundbar'), headphone: out('iconHeadphone'), tv: out('iconTv'), phone: out('iconPhone'), laptop: out('iconLaptop'), multiroom: out('iconMultiroom'), off: out('off'), track: out('track'), album: out('album'), pause: out('pause'), follow: out('follow'), device: out('device'), dsp: out('software'), fixed: out('fixed'), raop: 'AirPlay', dlna: 'DLNA', raat: 'RAAT' }
  return <view className='output-field'><text className='output-label'>{label}</text><view className='output-wrap'>{values.map(v => <Button key={v} selected={v === value} onTap={() => onChange(v)}>{labels[v] ?? v}</Button>)}</view></view>
}
const subscribeOutputs = (listener: () => void) => getQueryClient().getQueryCache().subscribe(listener)
function useOutputs() { useAppSessionStore(s => s.baseUrl); const data = useSyncExternalStore(subscribeOutputs, readOutputs); return { data } }
export function zoneLabel(group: OutputGroup, players = readOutputs().players) {
  if (group.members.length === 1) {
    const p = players.find(p => p.ID === group.master_id)
    const name = group.name || p?.Name || group.id
    if (p?.Kind === 'local' && players.some(other => other.ID !== p.ID && other.Kind === 'local' && other.Online && other.Name === p.Name)) {
      return `${name} · ${p.ID === useZoneState.getState().deviceId ? '当前客户端' : '客户端 ' + p.ID.slice(-6)}`
    }
    return name
  }
  return group.members.map(m => players.find(p => p.ID === m.player_id)?.Name ?? m.player_id).join('\n')
}
function zoneIcon(group?: OutputGroup, players = readOutputs().players): IconName {
  if (group && group.members.length > 1) return 'link'
  if (group?.icon) return ({ speaker: 'speaker', bookshelf: 'bookshelf', soundbar: 'soundbar', headphone: 'headphone', tv: 'tv', phone: 'phone', laptop: 'computer', multiroom: 'cast' } as Record<string, IconName>)[group.icon] ?? 'speaker'
  return !group || players.find(p => p.ID === group.master_id)?.Kind === 'local' ? 'computer' : 'speaker'
}

/** Always available, including idle and narrow layouts. */
export function OutputTransportControls({ part = 'all', compact = false }: { part?: 'all' | 'signal' | 'queue' | 'zone' | 'zone-volume'; compact?: boolean } = {}) {
  const out = useOutputText(), anchor = useTapAnchor()
  useZoneState(s => s.focus)
  const { data } = useOutputs()
  const g = focusedGroup(), volume = usePlayerStore(s => s.volume)
  const open = (panel: string) => anchor.measure(m => openOutputPanel(panel, m ?? undefined))
  return <view className='output-controls' id={anchor.anchorId} catchtap={() => {}}>
    {(part === 'all' || part === 'signal') && g && g.status.song_id > 0 && <Button onTap={() => open('signal')} testId='output-signal'><text className={`output-dot output-dot--${g.signal_path?.kind ?? 'local'}`}>●</text></Button>}
    {(part === 'all' || part === 'zone' || part === 'zone-volume') && <Button onTap={() => open('zones')} icon={zoneIcon(g, data.players)} label={g ? zoneLabel(g) : out('chooseZone')} testId='output-zones'>{compact ? '' : g ? (g.members.length > 1 ? `${data?.players.find(p => p.ID === g.master_id)?.Name ?? g.name} + ${g.members.length - 1}` : zoneLabel(g)) : out('chooseZone')}</Button>}
    {(part === 'all' || part === 'zone-volume') && g && <Button onTap={() => open('volume')} icon='volume' testId='output-volume'>{String(volumeInt(volume))}</Button>}
    {(part === 'all' || part === 'queue') && <view className='output-queue-entry'><Button label={out('queue')} onTap={() => usePlayerStore.getState().togglePlaylistDrawer()} icon='queue' testId='output-queue'>{''}</Button></view>}
  </view>
}

export function OutputRoot({ enabled }: { enabled: boolean }) {
  const base = useAppSessionStore(s => s.baseUrl)
  const panel = useZoneState(s => s.panel), anchor = useZoneState(s => s.anchor)
  const error = useZoneState(s => s.error), busy = useZoneState(s => s.busy)
  const focus = useZoneState(s => s.focus)
  const out = useOutputText()
  useEffect(() => {
    if (!enabled) return
    let disposed = false, stop: (() => void) | undefined
    void startOutputRuntime().then(cleanup => { if (disposed) cleanup(); else stop = cleanup }).catch(e => useZoneState.setState({ error: String(e) }))
    return () => { disposed = true; stop?.() }
  }, [enabled, base])
  useBackHandler(panel != null, () => { if (!busy) openOutputPanel(null); return true })
  const { data } = useOutputs()
  if (!enabled || !panel) return null
  const group = data?.groups.find(g => g.id === focus)
  const compact = ['zones', 'volume', 'signal'].includes(panel)
  const title = panel.startsWith('limit:') ? out('volumeLimit') : panel.startsWith('device:') ? (data.players.find(p => p.ID === panel.slice(7))?.Name ?? out('devices')) : panel === 'group' ? out('groupEdit') : (['zones', 'volume', 'signal', 'transfer', 'sleep', 'dsp', 'settings', 'outputs', 'metrics', 'party', 'alarms', 'allowlist', 'advanced'].includes(panel) ? out(panel as 'zones') : panel)
  const backPanel = panel.startsWith('limit:') ? 'settings' : panel.startsWith('device:') || ['add', 'advanced', 'alarms', 'party'].includes(panel) ? 'outputs' : ['metrics', 'allowlist'].includes(panel) ? 'advanced' : null
  const manager = ['outputs', 'advanced'].includes(panel) || panel.startsWith('device:')
  const detailClasses: Record<string, string> = { sleep: ' output-panel--detail output-detail--sleep', dsp: ' output-panel--detail output-detail--dsp', transfer: ' output-panel--detail output-detail--transfer', settings: ' output-panel--detail output-detail--settings', limit: ' output-panel--detail output-detail--limit' }
  const position = compact && anchor ? placePanel(anchor.anchor, anchor.viewport, pickMenuPlacement(anchor)) : DOCKED_POSITION
  return <>
    <ModalScrim className='output-backdrop' bindtap={() => { if (!busy) openOutputPanel(null) }} />
    <view className={`output-panel${compact ? ' output-panel--compact popover-menu popover-panel' : ''}${manager ? ' output-panel--manager' : ''}${['outputs', 'advanced'].includes(panel) ? ' output-panel--management-home' : ''}${panel === 'group' ? ' output-panel--group' : ''}${detailClasses[panel.startsWith('limit:') ? 'limit' : panel] ?? ''}`} style={compact ? position : undefined} catchtap={() => {}} data-testid={`output-panel-${panel.split(':')[0]}`}>
      {compact ? <BackdropBlur className='ui-backdrop-blur--panel' /> : <ModalMaterial shape='sheet' />}
      <view className='output-panel-header'><view className='output-panel-heading'>{backPanel && <Button disabled={busy} testId='output-back' label={out('back')} onTap={() => openOutputPanel(backPanel)} icon='chevron-left'>{''}</Button>}<text className='output-title' text-maxline='1'>{title}</text></view><Button disabled={busy} testId='output-close' label={out('close')} onTap={() => openOutputPanel(null)} icon='x'>{''}</Button></view>
      {panel === 'group' && group ? <GroupEditor key={group.id} group={group} players={data.players} groups={data.groups} /> : <scroll-view key={panel} className='output-panel-body' scroll-y>
        {error && <text className='output-error'>{error}</text>}
        {busy && <text>{'…'}</text>}
        <PanelBody key={`${panel}:${group?.id}`} panel={panel} group={group} players={data?.players ?? []} groups={data?.groups ?? []} />
      </scroll-view>}
    </view>
  </>
}

function PanelBody({ panel, group, players, groups }: { panel: string; group?: OutputGroup; players: OutputDevice[]; groups: OutputGroup[] }) {
  const out = useOutputText()
  const busy = useZoneState(s => s.busy)
  if (panel === 'zones') return <>
    {selectableZones(groups, players).map(g => <view key={g.id} className={`output-zone${g.id === group?.id ? ' output-selected' : ''}`}>
      <Button onTap={() => { void focusZone(g.id); openOutputPanel(null) }} icon={zoneIcon(g, players)} disabled={g.members.every(m => !players.find(p => p.ID === m.player_id)?.Online)}>{zoneLabel(g, players)}</Button>
      {g.status.state === 'playing' && <Button label={out('pause')} onTap={() => void outputAction(() => outputApi.transport(g.id, 'pause'))} icon='pause'>{''}</Button>}
    </view>)}
    {!groups.length && <text>{out('empty')}</text>}
    <view className='output-row'><Button onTap={() => void outputAction(async () => { for (const g of groups) if (g.status.state === 'playing') await outputApi.transport(g.id, 'pause') })} icon='pause'>{out('pauseAll')}</Button><Button onTap={() => openOutputPanel('group')} icon='link'>{out('group')}</Button></view>
  </>
  if (panel === 'outputs') return <OutputManagement players={players} group={group} />
  if (panel === 'advanced') return <view className='output-manager'><view className='output-management-list'>
    <OutputNavigation title={out('metrics')} detail={out('metricsHint')} icon='info' onTap={() => openOutputPanel('metrics')} />
    <OutputNavigation title={out('allowlist')} detail={out('allowlistHint')} icon='link' onTap={() => openOutputPanel('allowlist')} />
  </view><ServerOutputSettings /></view>
  if (panel === 'add') return <AddDevice />
  if (panel.startsWith('limit:')) return <VolumeLimit device={players.find(p => p.ID === panel.slice(6))} />
  if (panel.startsWith('device:')) return <DeviceSettings device={players.find(p => p.ID === panel.slice(7))} />
  if (panel === 'alarms') return <Alarms groups={groups} />
  if (panel === 'allowlist') return <Allowlist />
  if (panel === 'party') return <Party groups={groups} />
  if (panel === 'metrics') return <Metrics />
  if (panel === 'dsp') return <Dsp group={group} players={players} />
  if (!group) return <><text>{out('empty')}</text><Button onTap={() => openOutputPanel('zones')}>{out('zones')}</Button></>
  if (panel === 'signal') return <>
    <text className='output-title'>{zoneLabel(group, players)}</text>
    <text>{group.signal_path?.kind ?? out('local')}</text><text>{out('quality')}</text>
    {group.signal_path?.stages.map((stage, i) => <view key={i} className='output-signal-stage'><text className='output-label'>{stage.name}</text><text>{stage.detail}</text></view>)}
    {group.status.error && <text className='output-error'>{group.status.error}</text>}
  </>
  if (panel === 'volume') return <>
    <view className='output-volume-tools'>{(['sleep', 'dsp', 'transfer', 'settings'] as const).map((p, i) => <Button key={p} onTap={() => openOutputPanel(p)} label={out(p)} testId={`output-action-${p}`} icon={(['timer', 'tune', 'shuffle', 'settings'] as const)[i]}>{out(p)}</Button>)}</view>
    {group.members.map(m => { const p = players.find(p => p.ID === m.player_id); return p ? <DeviceVolume key={p.ID} device={p} /> : null })}
    {group.members.length > 1 && <view className='output-row'><Button onTap={() => void outputAction(() => outputApi.groupVolume(group.id, 0, true))} icon='volume-mute'>{out('muteAll')}</Button>{[-1, 1].map(delta => <Button key={delta} onTap={() => void outputAction(async () => { for (const m of group.members) { const p = players.find(p => p.ID === m.player_id); if (p) await outputApi.setVolume(p.ID, p.Volume + delta) } })}>{delta > 0 ? '+' : '−'}</Button>)}</view>}
  </>
  if (panel === 'transfer') return <>
    <text className='output-hint'>{out('transferHint')}</text>
    <text className='output-label'>{out('source')}</text><view className='output-selected output-summary output-transfer-source'><Icon name={zoneIcon(group, players)} size={30} color={ICON_COLORS.content2} /><text>{zoneLabel(group, players)}</text><text>{usePlayerStore.getState().currentSong?.title ?? out('noSong')}</text></view>
    <text className='output-label'>{out('to')}</text>
    {groups.filter(g => g.id !== group.id).map(g => <Button key={g.id} disabled={busy || group.status.song_id <= 0 || g.members.every(m => !players.find(p => p.ID === m.player_id)?.Online)} onTap={() => void outputAction(async () => { await outputApi.transfer(group.id, g.id); await refreshOutputs(); await focusZone(g.id); openOutputPanel(null) })} icon={zoneIcon(g, players)}>{`${zoneLabel(g, players)}${g.status.state === 'playing' ? '\n' + out('playingReplace') : ''}`}</Button>)}
    {groups.length === 1 && <text>{out('noTargets')}</text>}
  </>
  if (panel === 'group') return <GroupEditor group={group} players={players} groups={groups} />
  if (panel === 'settings') return <ZoneSettings group={group} players={players} />
  if (panel === 'sleep') return <Sleep group={group} />
  return null
}

function OutputNavigation({ title, detail, icon, onTap, testId }: { title: string; detail: string; icon: IconName; onTap(): void; testId?: string }) {
  return <view className='output-navigation' bindtap={onTap} accessibility-element={true} accessibility-traits='button' accessibility-label={title} data-testid={testId}>
    <view className='output-device-symbol'><Icon name={icon} size={21} color={ICON_COLORS.content2} /></view>
    <view className='output-device-copy'><text className='output-device-name'>{title}</text><text className='output-device-detail' text-maxline='1'>{detail}</text></view>
    <Icon name='chevron-right' size={16} color={ICON_COLORS.contentMuted} />
  </view>
}
function OutputManagement({ players, group }: { players: OutputDevice[]; group?: OutputGroup }) {
  const out = useOutputText(), busy = useZoneState(s => s.busy)
  const ordered = [...players].sort((a, b) => Number(b.Online) - Number(a.Online) || Number(a.Kind === 'local') - Number(b.Kind === 'local') || a.Name.localeCompare(b.Name))
  const detail = (p: OutputDevice) => p.Kind === 'local' ? out('localPlayer') : p.Kind === 'raop' ? (p.Caps.airplay2 ? 'AirPlay 2' : out('airplaySpeaker')) : p.Kind === 'dlna' ? out('dlnaSpeaker') : out('raatSpeaker')
  return <view className='output-manager'>
    <text className='output-manager-description'>{out('manageHint')}</text>
    <view className='output-manager-actions'>
      <view className='output-discover-action'><Button testId='output-discover' disabled={busy} onTap={() => void outputAction(() => outputApi.discover())} icon='refresh'>{out(busy ? 'searching' : 'discover')}</Button></view>
      <view className='output-add-action'><Button testId='output-add' onTap={() => openOutputPanel('add')} icon='plus'>{out('add')}</Button></view>
    </view>
    <view className='output-section-heading'><text className='output-section-label'>{out('deviceList')}</text><text className='output-section-count'>{`${players.filter(p => p.Online).length} ${out('onlineCount')} · ${players.length} ${out('deviceCount')}`}</text></view>
    <view className='output-management-list'>
      {ordered.map(p => <view key={p.ID} className={`output-device-entry${p.Online ? '' : ' output-device-entry--offline'}`} bindtap={() => openOutputPanel(`device:${p.ID}`)} accessibility-element={true} accessibility-traits='button' accessibility-label={p.Name} data-testid={`output-device-${p.ID}`}>
        <view className='output-device-symbol'><Icon name={p.Kind === 'local' ? 'computer' : 'speaker'} size={25} color={ICON_COLORS.content2} /></view>
        <view className='output-device-copy'><text className='output-device-name' text-maxline='1'>{p.Name}</text><text className='output-device-detail' text-maxline='1'>{`${detail(p)}${group?.members.some(m => m.player_id === p.ID) ? ' · ' + out('currentZone') : ''}`}</text></view>
        <view className='output-device-status'><view className={`output-status-dot${p.Online ? ' output-status-dot--online' : ''}`} /><text>{out(p.Online ? 'online' : 'offline')}</text></view>
        <Icon name='chevron-right' size={16} color={ICON_COLORS.contentMuted} />
      </view>)}
      {!players.length && <view className='output-empty-devices'><Icon name='speaker' size={34} color={ICON_COLORS.contentMuted} /><text className='output-device-name'>{out('emptyDevices')}</text><text className='output-device-detail'>{out('emptyDevicesHint')}</text></view>}
    </view>
    <view className='output-section-heading'><text className='output-section-label'>{out('playbackTools')}</text></view>
    <view className='output-management-list'>
      <OutputNavigation title={out('alarms')} detail={out('alarmHint')} icon='timer' onTap={() => openOutputPanel('alarms')} testId='output-manage-alarms' />
      <OutputNavigation title={out('party')} detail={out('partyHint')} icon='link' onTap={() => openOutputPanel('party')} testId='output-manage-party' />
      <OutputNavigation title={out('dsp')} detail={out('dspHint')} icon='tune' onTap={() => openOutputPanel('dsp')} testId='output-manage-dsp' />
    </view>
    <view className='output-advanced-entry'><OutputNavigation title={out('advanced')} detail={out('advancedHint')} icon='settings' onTap={() => openOutputPanel('advanced')} testId='output-manage-advanced' /></view>
  </view>
}

function DeviceVolume({ device: p }: { device: OutputDevice }) {
  const out = useOutputText(), [preview, setPreview] = useState<number | null>(null)
  const localVolume = useLocalPlayerStore(s => s.volume)
  const localId = useZoneState(s => s.deviceId)
  const actual = p.ID === localId ? localVolume : p.Volume
  const value = preview ?? volumeInt(actual)
  return <view className='output-device-volume'><text className='output-label'>{p.Name}</text><view className='output-volume-row'>
    <Button disabled={!p.Online || p.volume_mode === 'fixed'} onTap={() => void outputAction(() => outputApi.setVolume(p.ID, actual, !p.Muted))} icon={p.Muted ? 'volume-mute' : 'volume'}>{String(value)}</Button>
    <SliderRoot className='output-slider' value={value / 100} step={0.01} disabled={!p.Online || p.volume_mode === 'fixed'} onValueChange={v => setPreview(volumeInt(v * 100))} onValueCommit={v => { setPreview(null); void outputAction(() => outputApi.setVolume(p.ID, v * 100)) }}>
      <SliderTrack className='output-slider-track'><SliderIndicator className='output-slider-fill' /><SliderThumb className='output-slider-thumb-wrap'><view className='output-slider-thumb' /></SliderThumb></SliderTrack>
    </SliderRoot>
    {[-1, 1].map(delta => <Button key={delta} disabled={!p.Online || p.volume_mode === 'fixed'} onTap={() => void outputAction(() => outputApi.setVolume(p.ID, actual + delta))}>{delta > 0 ? '+' : '−'}</Button>)}
  </view><text className='output-hint'>{`0 — 100 · ${out('limitHelp')}`}</text></view>
}
function GroupEditor({ group, players, groups }: { group: OutputGroup; players: OutputDevice[]; groups: OutputGroup[] }) {
  const out = useOutputText(), [selected, setSelected] = useState(group.members.map(m => m.player_id))
  const busy = useZoneState(s => s.busy), error = useZoneState(s => s.error)
  const song = usePlayerStore(s => s.currentSong)
  const anchor = players.find(p => p.ID === group.master_id)
  const choices = groupChoices(group, groups, players)
  const changes = groupChanges(group, selected), changed = changes.add.length + changes.remove.length > 0
  const save = (ids: string[]) => void outputAction(async () => {
    const current = (await outputApi.outputs()).groups.find(g => g.id === group.id)
    if (!current || current.master_id !== group.master_id) throw new Error(out('groupChanged'))
    const plan = groupChanges(current, ids)
    try {
      for (const id of plan.add) await outputApi.member(group.id, id, 'POST')
      for (const id of plan.remove) await outputApi.member(group.id, id, 'DELETE')
    } finally { await refreshOutputs().catch(() => {}) }
    openOutputPanel(null)
  })
  const title = song?.id === group.status.song_id ? song.title : out('noSong')
  return <view className='output-group-editor'>
    <view className='output-group-current'>
      <view className='output-group-anchor'><Icon name={anchor?.Kind === 'local' ? 'computer' : 'speaker'} size={32} color={ICON_COLORS.content2} /><view className='output-group-anchor-copy'><text className='output-group-anchor-caption'>{out('currentZone')}</text><text className='output-group-anchor-name'>{anchor?.Name ?? group.name}</text></view><Button testId='output-group-ungroup' disabled={busy || group.members.length < 2} onTap={() => save([group.master_id])}>{out('ungroup')}</Button></view>
      <view className='output-group-track'><Icon name={group.status.state === 'playing' ? 'pause' : 'play'} size={18} color={ICON_COLORS.content2} /><view className='output-group-track-copy'><text className='output-group-track-title' text-maxline='1'>{title}</text>{song?.id === group.status.song_id && song.artist && <text className='output-group-track-artist' text-maxline='1'>{song.artist}</text>}</view></view>
    </view>
    <view className='output-group-section'><text className='output-label'>{out('addToGroup')}</text><text className='output-group-instruction'>{out('groupHint')}</text></view>
    <scroll-view key={group.id} className='output-group-choices' scroll-y>
      {choices.map(choice => {
        const checked = choice.playerIds.every(id => selected.includes(id)), disabled = busy || choice.unavailable || choice.incompatible
        return <view key={choice.id} className={`output-group-choice${disabled ? ' output-group-choice--disabled' : ''}`} bindtap={disabled ? undefined : () => setSelected(s => toggleGroupChoice(s, choice, group.master_id))} accessibility-element={true} accessibility-traits='button' accessibility-label={`${checked ? '✓ ' : ''}${choice.names.join(', ')}`} data-testid={`output-group-choice-${choice.id}`}>
          <view className={`output-group-checkbox${checked ? ' output-group-checkbox--checked' : ''}`}>{checked && <Icon name='check' size={14} color={ICON_COLORS.primaryContent} />}</view>
          <Icon name={choice.playerIds.length > 1 ? 'link' : choice.local ? 'computer' : 'speaker'} size={30} color={ICON_COLORS.content2} />
          <view className='output-group-choice-copy'><text className='output-group-choice-name'>{choice.names.join('\n')}</text>{(choice.existing || choice.incompatible || choice.unavailable) && <text className='output-group-choice-note'>{out(choice.unavailable ? choice.playerIds.length === 1 ? 'offline' : 'groupUnavailable' : choice.incompatible ? 'groupIncompatible' : 'groupExisting')}</text>}</view>
        </view>
      })}
      {!choices.length && <text className='output-group-instruction'>{out('groupNoOthers')}</text>}
      {error && <text className='output-error'>{error}</text>}
    </scroll-view>
    <view className='output-group-footer'><text className='output-group-selection'>{selected.length > 1 ? `${selected.length - 1} ${out('groupSelected')}` : out('groupEmptySelection')}</text><view className='output-group-actions'><view className='output-group-save'><Button disabled={busy || !changed} testId='output-group-save' onTap={() => save(selected)}>{out(busy ? 'groupSaving' : 'save')}</Button></view><view className='output-group-cancel'><Button disabled={busy} testId='output-group-cancel' onTap={() => openOutputPanel(null)}>{out('cancel')}</Button></view></view></view>
  </view>
}
function ZoneSettings({ group, players }: { group: OutputGroup; players: OutputDevice[] }) {
  const out = useOutputText(), [name, setName] = useState(group.name), [icon, setIcon] = useState(group.icon || 'speaker')
  return <><text className='output-section-label'>{out('zoneIdentity')}</text><view className='output-settings-card'><Field label={out('name')} value={name} onChange={setName} /><Choices label={out('icon')} value={icon} values={['speaker', 'bookshelf', 'soundbar', 'headphone', 'tv', 'phone', 'laptop', 'multiroom']} onChange={setIcon} />
    <Button disabled={!name.trim() || name.trim().length > 40} onTap={() => void outputAction(() => outputApi.updateGroup(group.id, { name: name.trim(), icon }))}>{out('save')}</Button></view><text className='output-section-label'>{out('memberSettings')}</text>
    {group.members.map((m, i) => <view key={m.player_id} className='output-card'><view className='output-speaker-card'><Icon name='speaker' size={30} color={ICON_COLORS.content2} /><view className='output-device-copy'><text className='output-device-name'>{players.find(p => p.ID === m.player_id)?.Name ?? m.player_id}</text><text className='output-device-detail'>{players.find(p => p.ID === m.player_id)?.Address}</text></view><view className='output-speaker-actions'><Button testId={'output-limit-' + m.player_id} onTap={() => openOutputPanel('limit:' + m.player_id)} icon='volume'>{out('volumeLimit')}</Button><Button onTap={() => openOutputPanel('device:' + m.player_id)} icon='settings'>{out('deviceSettings')}</Button></view></view>
      <NumberField commitOnly label={out('delay')} value={m.delay_ms} onChange={v => void outputAction(() => outputApi.member(group.id, m.player_id, 'PATCH', { delay_ms: Math.max(-2000, Math.min(2000, v)), volume_offset: m.volume_offset }))} />
      <NumberField commitOnly label={out('offset')} value={m.volume_offset} onChange={v => void outputAction(() => outputApi.member(group.id, m.player_id, 'PATCH', { delay_ms: m.delay_ms, volume_offset: Math.max(-100, Math.min(100, v)) }))} />
      <view className='output-wrap'><Button disabled={m.player_id === group.master_id} onTap={() => void outputAction(() => outputApi.request(`/groups/${outputId(group.id)}/master`, 'POST', { player_id: m.player_id }))}>{out('master')}</Button>
        <Button disabled={i === 0} onTap={() => void outputAction(() => { const ids = group.members.map(m => m.player_id); [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!]; return outputApi.request(`/groups/${outputId(group.id)}/members/order`, 'PUT', { player_ids: ids }) })}>{out('moveUp')}</Button></view>
    </view>)}
  </>
}
function VolumeLimit({ device }: { device?: OutputDevice }) {
  const out = useOutputText(), [maximum, setMaximum] = useState(device?.max_volume ?? 100)
  if (!device) return <text>{out('offline')}</text>
  return <><view className='output-detail-hero'><Icon name='speaker' size={32} color={ICON_COLORS.content2} /><text className='output-hero-title'>{device.Name}</text><text className='output-hint'>{out('volumeLimitHint')}</text></view>
    <view className='output-volume-row'><SliderRoot className='output-slider' value={maximum / 100} step={0.01} onValueChange={v => setMaximum(volumeInt(v * 100))}><SliderTrack className='output-slider-track'><SliderIndicator className='output-slider-fill' /><SliderThumb className='output-slider-thumb-wrap'><view className='output-slider-thumb' /></SliderThumb></SliderTrack></SliderRoot><text>{maximum}</text></view>
    <NumberField label={out('maximumVolume')} value={maximum} onChange={v => setMaximum(volumeInt(v))} />
    <Button onTap={() => setMaximum(100)}>{out('resetLimit')}</Button>
    <view className='output-detail-actions'><Button onTap={() => openOutputPanel('settings')}>{out('cancel')}</Button><view className='output-primary-action'><Button onTap={() => void outputAction(async () => { await outputApi.updateDevice(device.ID, { max_volume: maximum }); openOutputPanel('settings') })}>{out('save')}</Button></view></view>
  </>
}
function DeviceSettings({ device: p }: { device?: OutputDevice }) {
  const out = useOutputText(), [name, setName] = useState(p?.Name ?? ''), [password, setPassword] = useState(''), [mode, setMode] = useState(p?.volume_mode ?? 'device'), [max, setMax] = useState(p?.max_volume ?? 100), [takeover, setTakeover] = useState(p?.Takeover ?? 'pause'), [remove, setRemove] = useState(false)
  if (!p) return <text>{out('offline')}</text>
  return <><text className='output-device-detail'>{`${p.Kind === 'raop' ? 'AirPlay' : p.Kind === 'local' ? out('localPlayer') : p.Kind.toUpperCase()}${p.Address ? ' · ' + p.Address : ''}${p.Model && p.Model !== '0,2' ? ' · ' + p.Model : ''}`}</text><Field label={out('rename')} value={name} onChange={setName} />
    <Choices label={out('volumeMode')} value={mode} values={['device', 'dsp', 'fixed']} onChange={setMode} />
    <NumberField label={out('maxVolume')} value={max} onChange={v => setMax(volumeInt(v))} />
    <Choices label={out('takeover')} value={takeover} values={['pause', 'follow']} onChange={setTakeover} />
    {p.Kind === 'raop' && <Field type='password' label={out('password')} value={password} onChange={setPassword} />}
    <Button disabled={!name.trim()} onTap={() => void outputAction(() => outputApi.updateDevice(p.ID, { name: name.trim(), volume_mode: mode, max_volume: max, takeover_behavior: takeover, ...(password ? { password } : {}) }))}>{out('save')}</Button>
    <text>{out(p.standby ? 'standby' : 'awake')}</text><text className='output-hint'>{out('standbyHelp')}</text><DeviceVolume device={p} /><Eq device={p} />
    <view className='output-wrap'><Button onTap={() => void outputAction(() => outputApi.request(`/players/${outputId(p.ID)}/reconnect`, 'POST', {}))}>{out('reconnect')}</Button>
      {[true, false].map(on => <Button key={String(on)} onTap={() => void outputAction(() => outputApi.request(`/players/${outputId(p.ID)}/power`, 'POST', { on }))}>{out(on ? 'powerOn' : 'powerOff')}</Button>)}
      <Button onTap={() => { if (!remove) { setRemove(true); return }; void outputAction(async () => { await outputApi.request(`/players/${outputId(p.ID)}`, 'DELETE'); openOutputPanel('outputs') }) }}>{out(remove ? 'confirmRemove' : 'remove')}</Button></view>
  </>
}
function AddDevice() {
  const out = useOutputText(), [name, setName] = useState(''), [address, setAddress] = useState(''), [kind, setKind] = useState('raop')
  const [deviceId, setDeviceId] = useState(''), [publicKey, setPublicKey] = useState('')
  return <><Field label={out('name')} value={name} onChange={setName} /><Field label={out('address')} value={address} onChange={setAddress} /><Choices label={out('kind')} value={kind} values={['raop', 'dlna', 'raat']} onChange={setKind} />
    {kind === 'raop' && <><Field label='Device ID (MAC)' value={deviceId} onChange={setDeviceId} /><Field label='RSA Public Key' value={publicKey} onChange={setPublicKey} /></>}
    <Button disabled={!address.trim() || (kind === 'raop' && !deviceId.trim())} onTap={() => void outputAction(async () => { await outputApi.request('/players', 'POST', { name: name.trim(), address: address.trim(), kind, device_id: deviceId.trim(), public_key: publicKey.trim() }); openOutputPanel('outputs') })}>{out('save')}</Button></>
}
function Sleep({ group }: { group: OutputGroup }) {
  const out = useOutputText(), [minutes, setMinutes] = useState(30)
  const { data } = useQuery({ queryKey: [...outputKey(), 'sleep', group.id], queryFn: () => outputApi.sleep(group.id), refetchInterval: 1000 })
  return <view className='output-sleep'>
    <view className='output-detail-hero'><view className='output-hero-symbol'><Icon name='timer' size={28} color={ICON_COLORS.primary} /></view><text className='output-hero-title'>{zoneLabel(group)}</text><text className='output-hint'>{out('sleepHint')}</text></view>
    <text className='output-section-label'>{out('durationLabel')}</text>
    <view className='output-duration-options'>{[15, 30, 45, 60, 120].map(value => <Button key={value} selected={minutes === value} onTap={() => setMinutes(value)}>{value < 60 ? value + ' ' + out('minutes') : value / 60 + ' h'}</Button>)}</view>
    <NumberField label={out('customDuration')} value={minutes} onChange={setMinutes} />
    <text className='output-hint'>{data?.active ? out('remaining') + ' ' + Math.ceil(data.remaining_seconds / 60) + ' ' + out('minutes') : out('sleepEmpty')}</text>
    <view className='output-detail-actions'><view className='output-primary-action'><Button disabled={minutes < 1 || minutes > 1440} onTap={() => void outputAction(async () => { await outputApi.sleep(group.id, minutes); openOutputPanel(null) })}>{out('sleepSet')}</Button></view>{data?.active && <Button onTap={() => void outputAction(async () => { await outputApi.sleep(group.id, 0); openOutputPanel(null) })}>{out('sleepCancel')}</Button>}</view>
  </view>
}
function Eq({ device }: { device: OutputDevice }) {
  const out = useOutputText(), [profile, setProfile] = useState<EqProfile>(device.EQ)
  const { data: presets } = useQuery({ queryKey: [...outputKey(), 'eq-presets', device.ID], queryFn: () => outputApi.request<{ id: string; name: string; bands: number[]; preamp: number }[]>(`/players/${outputId(device.ID)}/eq/presets`) })
  return <view className='output-card output-eq-card'><text className='output-title'>{device.Name}</text><text className='output-hint'>{out('equalizer')}</text><Toggle label={out('enabled')} checked={profile.enabled} onChange={enabled => setProfile({ ...profile, enabled })} />
    <view className='output-wrap'>{presets?.map(p => <Button key={p.name} onTap={() => setProfile({ enabled: true, preset: p.id, bands: p.bands, preamp: p.preamp })}>{p.name}</Button>)}</view>
    <NumberField label={out('preamp')} value={profile.preamp} onChange={v => setProfile({ ...profile, preamp: Math.max(-24, Math.min(24, v)) })} />
    <view className='output-eq-bands'>{[31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((hz, i) => {
      const gain = profile.bands[i] ?? 0
      return <view className='output-eq-band' key={hz}><text className='output-eq-frequency'>{hz >= 1000 ? hz / 1000 + 'k' : hz} Hz</text><SliderRoot className='output-slider' value={(gain + 12) / 24} step={1 / 48} onValueChange={v => { const bands = Array.from({ length: 10 }, (_, j) => j === i ? Math.round((v * 24 - 12) * 2) / 2 : profile.bands[j] ?? 0); setProfile({ ...profile, bands, preset: '' }) }}><SliderTrack className='output-slider-track'><SliderIndicator className='output-slider-fill' /><SliderThumb className='output-slider-thumb-wrap'><view className='output-slider-thumb' /></SliderThumb></SliderTrack></SliderRoot><text className='output-eq-gain'>{gain > 0 ? '+' : ''}{gain.toFixed(1)} dB</text></view>
    })}</view>
    <Button onTap={() => void outputAction(async () => { const saved = await outputApi.setEq(device.ID, profile); setProfile(saved) })}>{out('save')}</Button></view>
}
function Dsp({ group, players }: { group?: OutputGroup; players: OutputDevice[] }) {
  const out = useOutputText()
  return <><text className='output-hint'>{out('quality')}</text><text className='output-section-label'>{out('audioGlobal')}</text><view className='output-settings-card'><Tuning /></view><text className='output-section-label'>{out('audioDevices')}</text>{group?.members.map(m => { const p = players.find(p => p.ID === m.player_id); return p ? <Eq key={p.ID} device={p} /> : null })}</>
}
function Tuning() {
  const out = useOutputText()
  const { data, refetch } = useQuery({ queryKey: [...outputKey(), 'tuning'], queryFn: async () => ({ cross: await outputApi.request<{ enabled: boolean; seconds: number }>('/settings/crossfade'), gain: await outputApi.request<{ mode: string; prevent_clipping: boolean }>('/settings/replaygain') }) })
  if (!data) return null
  return <><text className='output-title'>{out('crossfade')}</text><text>{out('crossfadeHelp')}</text>
    <Toggle label={out('enabled')} checked={data.cross.enabled} onChange={enabled => void outputAction(async () => { await outputApi.request('/settings/crossfade', 'PUT', { ...data.cross, enabled }); await refetch() })} />
    <NumberField commitOnly label={out('seconds')} value={data.cross.seconds} onChange={seconds => void outputAction(async () => { await outputApi.request('/settings/crossfade', 'PUT', { ...data.cross, seconds }); await refetch() })} />
    <Choices label={out('replaygain')} value={data.gain.mode} values={['off', 'track', 'album']} onChange={mode => void outputAction(async () => { await outputApi.request('/settings/replaygain', 'PUT', { ...data.gain, mode }); await refetch() })} />
    <Toggle label={out('preventClipping')} checked={data.gain.prevent_clipping} onChange={prevent_clipping => void outputAction(async () => { await outputApi.request('/settings/replaygain', 'PUT', { ...data.gain, prevent_clipping }); await refetch() })} />
  </>
}
function Metrics() {
  const out = useOutputText()
  const { data, error } = useQuery({ queryKey: [...outputKey(), 'metrics'], queryFn: () => outputApi.request<Record<string, unknown>>('/playback/metrics'), refetchInterval: 2000 })
  const labels: Record<string, string> = { decode_slots_used: out('slotsUsed'), decode_slots_max: out('slotsMax'), groups: out('zones'), players: out('devices'), player_underruns_total: out('underruns'), player_sink_dropped_frames_total: out('dropped'), player_resyncs_total: out('resyncs'), player_events_dropped_total: out('eventsDropped'), player_drift_ms: out('drift') }
  return <>{error && <text className='output-error'>{String(error)}</text>}
    {data && Number(data.decode_slots_max) > 0 && Number(data.decode_slots_used) >= Number(data.decode_slots_max) && <text className='output-error'>{out('saturated')}</text>}
    <view className='output-wrap'>{Object.entries(labels).map(([key, label]) => <view className='output-card' key={key}><text className='output-label'>{label}</text><text>{String(data?.[key] ?? '—')}</text></view>)}</view>
    {((data?.owners ?? []) as { owner: string; state: string; buffering: boolean; drift_ms: number; targets: number }[]).map(owner => <view className='output-card' key={owner.owner}><text>{owner.owner}</text><text>{owner.state} · {owner.buffering ? out('buffering') : ''} · {owner.drift_ms} ms · {owner.targets} {out('devices')}</text></view>)}
  </>
}
function Allowlist() {
  const out = useOutputText(), [value, setValue] = useState('')
  useEffect(() => { void outputApi.request<{ entries: string[] }>('/settings/player-output-allowlist').then(v => setValue((v.entries ?? []).join(', '))).catch(e => useZoneState.setState({ error: String(e) })) }, [])
  return <><text>{out('allowlistHelp')}</text><Field label={out('allowlist')} value={value} onChange={setValue} /><Button onTap={() => void outputAction(() => outputApi.request('/settings/player-output-allowlist', 'PUT', { entries: value.split(/[,\n]/).map(s => s.trim()).filter(Boolean) }))}>{out('save')}</Button></>
}
interface OutputSetting { max_groups: number; default_latency_ms: number; dlna_realign_interval_minutes: number; allow_private_network: boolean; network_sinks_enabled: boolean; party_enabled: boolean; party_drift_tolerance_ms: number }
interface DiscoverySetting { enabled: boolean; protocols: string[]; interval_seconds: number }
function ServerOutputSettings() {
  const out = useOutputText()
  const [output, setOutput] = useState<OutputSetting | null>(null)
  const [discovery, setDiscovery] = useState<DiscoverySetting | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all([outputApi.request<OutputSetting>('/settings/player-output'), outputApi.request<DiscoverySetting>('/settings/player-discovery')]).then(([a, b]) => { if (alive) { setOutput(a); setDiscovery(b) } }).catch(e => { if (alive) useZoneState.setState({ error: String(e) }) })
    return () => { alive = false }
  }, [])
  if (!output || !discovery) return null
  return <view className='output-card'><text className='output-title'>{out('outputConfig')}</text>
    <Toggle label={out('networkSinks')} checked={output.network_sinks_enabled} onChange={v => setOutput({ ...output, network_sinks_enabled: v })} />
    <Toggle label={out('privateNetwork')} checked={output.allow_private_network} onChange={v => setOutput({ ...output, allow_private_network: v })} />
    <Toggle label={out('party')} checked={output.party_enabled} onChange={v => setOutput({ ...output, party_enabled: v })} />
    <NumberField label={out('maxGroups')} value={output.max_groups} onChange={v => setOutput({ ...output, max_groups: Math.round(v) })} />
    <NumberField label={out('latency')} value={output.default_latency_ms} onChange={v => setOutput({ ...output, default_latency_ms: Math.round(v) })} />
    <NumberField label={out('realign')} value={output.dlna_realign_interval_minutes} onChange={v => setOutput({ ...output, dlna_realign_interval_minutes: Math.round(v) })} />
    <NumberField label={out('driftTolerance')} value={output.party_drift_tolerance_ms} onChange={v => setOutput({ ...output, party_drift_tolerance_ms: Math.round(v) })} />
    <Toggle label={out('discoveryConfig')} checked={discovery.enabled} onChange={v => setDiscovery({ ...discovery, enabled: v })} />
    <NumberField label={out('scanInterval')} value={discovery.interval_seconds} onChange={v => setDiscovery({ ...discovery, interval_seconds: Math.round(v) })} />
    {['raop', 'dlna', 'raat'].map(protocol => <Toggle key={protocol} label={protocol === 'raop' ? 'AirPlay' : protocol.toUpperCase()} checked={discovery.protocols.includes(protocol)} onChange={v => setDiscovery({ ...discovery, protocols: v ? [...discovery.protocols, protocol] : discovery.protocols.filter(p => p !== protocol) })} />)}
    <Button onTap={() => void outputAction(async () => { await outputApi.request('/settings/player-output', 'PUT', output); await outputApi.request('/settings/player-discovery', 'PUT', discovery) })}>{out('save')}</Button>
  </view>
}
interface Alarm { id?: string; name: string; target_id: string; time_of_day: string; days_mask: number; playlist_id: number; volume: number; fade_seconds: number; enabled: boolean }
function Alarms({ groups }: { groups: OutputGroup[] }) {
  const out = useOutputText(), [edit, setEdit] = useState<Alarm | null>(null)
  const { data, refetch, error } = useQuery({ queryKey: [...outputKey(), 'alarms'], queryFn: () => outputApi.request<Alarm[]>('/alarms') })
  const playlists = useQuery({ queryKey: [...outputKey(), 'playlists'], queryFn: async () => { const playlists: { id: number; name: string }[] = []; for (let offset = 0; ; offset += 100) { const page = await outputApi.request<{ playlists: { id: number; name: string }[] }>(`/playlists?limit=100&offset=${offset}`); playlists.push(...page.playlists); if (page.playlists.length < 100) break }; return { playlists } } })
  return <>{error && <text className='output-error'>{String(error)}</text>}{data?.map(a => <view className='output-card' key={a.id}><Button onTap={() => setEdit({ ...a })}>{`${a.name} · ${a.time_of_day} · ${groups.find(g => g.id === a.target_id)?.name ?? a.target_id}`}</Button><Toggle label={out('enabled')} checked={a.enabled} onChange={enabled => void outputAction(async () => { await outputApi.request(`/alarms/${a.id}`, 'PUT', { ...a, enabled }); await refetch() })} /><view className='output-wrap'><Button onTap={() => void outputAction(() => outputApi.request(`/alarms/${a.id}/test`, 'POST', {}))}>{out('test')}</Button><Button onTap={() => void outputAction(async () => { await outputApi.request(`/alarms/${a.id}`, 'DELETE'); await refetch() })}>{out('remove')}</Button></view></view>)}
    <Button onTap={() => setEdit({ name: out('alarms'), target_id: groups[0]?.id ?? '', time_of_day: '07:30', days_mask: 127, playlist_id: 0, volume: 15, fade_seconds: 30, enabled: true })}>{out('addAlarm')}</Button>
    {edit && <view className='output-card'><Field label={out('name')} value={edit.name} onChange={name => setEdit({ ...edit, name })} /><Field label={out('time')} value={edit.time_of_day} onChange={time_of_day => setEdit({ ...edit, time_of_day })} />
      <view className='output-wrap'>{groups.map(g => <Button key={g.id} onTap={() => setEdit({ ...edit, target_id: g.id })}>{`${g.id === edit.target_id ? '● ' : ''}${zoneLabel(g)}`}</Button>)}</view>
      <view className='output-wrap'>{(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day, i) => <Button key={day} onTap={() => setEdit({ ...edit, days_mask: edit.days_mask ^ (1 << i) })}>{`${edit.days_mask & (1 << i) ? '● ' : ''}${out(day)}`}</Button>)}</view>
      <text>{out('playlist')}</text><Button onTap={() => setEdit({ ...edit, playlist_id: 0 })}>{out('volumeOnly')}</Button>{playlists.data?.playlists.map(p => <Button key={p.id} onTap={() => setEdit({ ...edit, playlist_id: p.id })}>{`${p.id === edit.playlist_id ? '● ' : ''}${p.name}`}</Button>)}
      <NumberField label={out('volume')} value={edit.volume} onChange={volume => setEdit({ ...edit, volume: volumeInt(volume) })} /><NumberField label={out('fade')} value={edit.fade_seconds} onChange={fade_seconds => setEdit({ ...edit, fade_seconds })} />
      <Button disabled={!edit.target_id || !/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.time_of_day)} onTap={() => void outputAction(async () => { await outputApi.request(`/alarms${edit.id ? '/' + edit.id : ''}`, edit.id ? 'PUT' : 'POST', edit); setEdit(null); await refetch() })}>{out('save')}</Button><Button onTap={() => setEdit(null)}>{out('cancel')}</Button>
    </view>}
  </>
}
function Party({ groups }: { groups: OutputGroup[] }) {
  const out = useOutputText(), [selected, setSelected] = useState<string[]>([]), [name, setName] = useState(''), [partyId, setPartyId] = useState(groups.find(g => g.party_id)?.party_id ?? '')
  const { data, refetch } = useQuery({ queryKey: [...outputKey(), 'party', partyId], enabled: !!partyId, refetchInterval: 2000, queryFn: () => outputApi.request<{ name: string; members: { group_id: string; offset_ms: number; state: string; unaligned: boolean; drifting: boolean }[] }>(`/playback/party/${outputId(partyId)}`) })
  return <><Field label={out('name')} value={name} onChange={setName} /><text>{out('selectGroup')}</text>{groups.map(g => <Button key={g.id} onTap={() => setSelected(s => s.includes(g.id) ? s.filter(id => id !== g.id) : [...s, g.id])} icon={selected.includes(g.id) ? 'check-circle' : 'radio'}>{zoneLabel(g)}</Button>)}
    <Button disabled={selected.length < 2 || !name.trim()} onTap={() => void outputAction(async () => { const p = await outputApi.request<{ id: string }>('/playback/party', 'POST', { name: name.trim(), group_ids: selected }); setPartyId(p.id) })}>{out('createParty')}</Button>
    {!!partyId && <><Button onTap={() => void outputAction(async () => { await outputApi.request(`/playback/party/${outputId(partyId)}/groups`, 'POST', { action: 'end' }); setPartyId('') })}>{out('endParty')}</Button><text className='output-title'>{data?.name}</text>{data?.members.map(member => <view className='output-card' key={member.group_id}><text>{groups.find(g => g.id === member.group_id) ? zoneLabel(groups.find(g => g.id === member.group_id)!) : member.group_id}</text><text>{`${member.state} · ${member.offset_ms} ms · ${out(member.unaligned || member.drifting ? 'aligned' : 'synced')}`}</text></view>)}<view className='output-wrap'>{(['play', 'pause', 'stop'] as const).map(action => <Button key={action} onTap={() => void outputAction(async () => { await outputApi.request(`/playback/party/${outputId(partyId)}/transport`, 'POST', { action }); await refetch() })}>{out(action === 'play' ? 'active' : action)}</Button>)}</view>
      {groups.map(g => <view className='output-wrap' key={g.id}><text>{zoneLabel(g)}</text>{['join', 'leave', 'leave-stop'].map(action => <Button key={action} onTap={() => void outputAction(async () => { await outputApi.request(`/playback/party/${outputId(partyId)}/groups`, 'POST', { action: action === 'leave-stop' ? 'leave' : action, group_id: g.id, mode: action === 'leave-stop' ? 'stop' : 'continue' }); await refetch() })}>{out(action === 'join' ? 'add' : action === 'leave-stop' ? 'leaveStop' : 'leaveContinue')}</Button>)}</view>)}</>}
  </>
}
