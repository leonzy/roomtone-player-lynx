import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import { getQueryClient } from '../../lib/query/index.js'
import { getSongloftStorage } from '../../core/storage/index.js'
import { useAppSessionStore } from '../../store/app-session.js'
import { getSharedClient } from '../../core/network/api-client.js'
import { apiPrefix } from '../../core/config/app-config.js'
import { getPlatformTarget } from '../../native/platform-target.js'
import { getAudio } from '../../native/index.js'
import type { Song } from '../../models/song.js'
import { patchSongMetadata, updatedSong } from '../../models/song-metadata.js'
import type { PlayerState } from '../player/store/player-store.js'
import { outputApi, outputId, type OutputGroup, type Outputs, type OutputStatus } from './api.js'
import { connectPlaybackSocket, type PlaybackConnection } from './socket.js'
import type { AnchorMeasurement } from '../../shared/ui/anchored-overlay.js'

export const useZoneState = create<{
  focus: string | null; deviceId: string | null; connected: boolean; error: string;
  panel: string | null; busy: boolean; anchor?: AnchorMeasurement;
}>(() => ({ focus: null, deviceId: null, connected: false, error: '', panel: null, busy: false }))
const empty: Outputs = { players: [], groups: [] }
export const outputKey = () => ['roomtone', useAppSessionStore.getState().baseUrl, 'outputs'] as const
export function readOutputs(): Outputs { return getQueryClient().getQueryData<Outputs>(outputKey()) ?? empty }
export function focusedGroup() { const id = useZoneState.getState().focus; return id ? readOutputs().groups.find(g => g.id === id) : undefined }
export function localGroup() {
  const id = useZoneState.getState().deviceId
  return readOutputs().groups.find(g => g.members.some(m => m.player_id === id))
}
export function remoteGroup() {
  const g = focusedGroup()
  return g && !g.members.some(m => m.player_id === useZoneState.getState().deviceId) ? g : undefined
}
export function openOutputPanel(panel: string | null, anchor?: AnchorMeasurement) { useZoneState.setState({ panel, anchor, error: '' }) }
export async function outputAction(action: () => Promise<unknown>) {
  if (useZoneState.getState().busy) return
  useZoneState.setState({ busy: true, error: '' })
  try { await action(); await refreshOutputs() }
  catch (e) { useZoneState.setState({ error: String(e) }) }
  finally { useZoneState.setState({ busy: false }) }
}
let refreshGeneration = 0
export async function refreshOutputs() {
  const generation = ++refreshGeneration
  const key = outputKey()
  const value = await outputApi.outputs()
  if (generation !== refreshGeneration) return value
  getQueryClient().setQueryData(key, value)
  if (!focusedGroup() && localGroup()) useZoneState.setState({ focus: localGroup()!.id })
  await projectRemote()
  return value
}
let local: StoreApi<PlayerState> | null = null
let display: StoreApi<PlayerState> | null = null
let remoteSongs: Song[] = []
let adoptGeneration = 0
let lastSongIds = ''

/** Metadata edits update every zone's cached songs without a transport command. */
export function updateOutputSong(saved: Song) {
  getQueryClient().setQueriesData({ queryKey: [...outputKey(), 'songs'] }, data => patchSongMetadata(data, saved))
  remoteSongs = patchSongMetadata(remoteSongs, saved) as Song[]
  if (local) {
    const state = local.getState()
    const playlist = patchSongMetadata(state.playlist, saved) as Song[]
    const currentSong = updatedSong(state.currentSong, saved)
    if (playlist !== state.playlist || currentSong !== state.currentSong) local.setState({ playlist, currentSong })
  }
  publishDisplay()
}
export async function focusZone(id: string | null) {
  useZoneState.setState({ focus: id, error: '' })
  if (id) void getSongloftStorage().prefs.set(`roomtone.focus:${useAppSessionStore.getState().baseUrl}`, id).catch(() => {})
  remoteSongs = []; lastSongIds = ''; adoptGeneration++
  publishDisplay()
  await projectRemote()
}
async function projectRemote() {
  const g = remoteGroup()
  if (!g) { publishDisplay(); return }
  const generation = ++adoptGeneration
  const ids = g.status.queue.items
  const key = `${g.id}:${ids.join(',')}`
  if (key !== lastSongIds) {
    const client = getQueryClient()
    const prefix = [...outputKey(), 'songs', g.id]
    const queryKey = [...prefix, ids]
    const songs = await client.fetchQuery({ queryKey, queryFn: () => outputApi.songs(ids), staleTime: 60_000, gcTime: 60_000 })
    if (generation !== adoptGeneration || remoteGroup()?.id !== g.id) return
    remoteSongs = songs; lastSongIds = key
    const currentHash = client.getQueryCache().find({ queryKey, exact: true })?.queryHash
    client.removeQueries({ queryKey: prefix, predicate: query => query.queryHash !== currentHash })
  }
  publishDisplay()
}
function publishDisplay() {
  if (!local || !display) return
  const state = local.getState(), g = remoteGroup()
  if (!g) { display.setState({ ...state, ...routedActions }); return }
  const s = g.status, song = remoteSongs[s.queue.current]
  const devices = readOutputs().players.filter(p => g.members.some(m => m.player_id === p.ID))
  display.setState({ ...state, ...routedActions, playlist: remoteSongs,
    currentIndex: s.queue.current, currentSong: song, currentTime: s.position * 1000,
    duration: (song?.duration ?? 0) * 1000, isPlaying: s.state === 'playing',
    isBuffering: ['loading', 'buffering'].includes(s.state), errorMessage: s.error,
    volume: devices.length ? Math.round(devices.reduce((n, p) => n + p.Volume, 0) / devices.length) : 0,
    playMode: s.queue.shuffle ? 'random' : s.queue.repeat === 'all' ? 'loop' : s.queue.repeat === 'one' ? 'single' : 'order',
    playbackContext: undefined, sourcePlaylistId: undefined, hasPriorityNext: false, speed: 1, sleepTimer: undefined,
    hasHistoryPrevious: s.queue.current > 0, nextQueueIndex: s.queue.current < s.queue.items.length - 1 ? s.queue.current + 1 : null,
  })
}
async function remoteTransport(action: string, extra: Record<string, unknown> = {}) {
  const group = remoteGroup()
  if (!group) return
  await outputApi.transport(group.id, action, extra); await refreshOutputs()
}
async function remoteQueue(songs: Song[], index: number, play: boolean) {
  const g = remoteGroup(); if (!g) return
  await outputApi.replaceQueue(g.id, songs.map(s => s.id), index)
  if (play && songs.length) await outputApi.transport(g.id, 'play')
  await refreshOutputs()
}
/** Capture the destination before asynchronous page fetching or a focus change. */
export function createQueueAppender(position: 'end' | 'next') {
  const id = remoteGroup()?.id, engine = local
  return async (songs: Song[]) => {
    if (!songs.length) return
    if (!id) {
      if (!engine) throw new Error('Local player is not ready')
      if (position === 'next') engine.getState().insertNextInQueue(songs)
      else engine.getState().addToPlaylist(songs)
      return
    }
    const batches: Song[][] = []
    for (let offset = 0; offset < songs.length; offset += 200) batches.push(songs.slice(offset, offset + 200))
    if (position === 'next') batches.reverse()
    for (const batch of batches) await outputApi.request(`/groups/${outputId(id)}/queue`, 'POST', { song_ids: batch.map(song => song.id), position })
    await refreshOutputs()
  }
}
export function createCollectionAction(action: 'shuffle' | 'next' | 'end') {
  if (action !== 'shuffle') return createQueueAppender(action)
  const id = remoteGroup()?.id, engine = local
  return async (songs: Song[]) => {
    if (!songs.length) return
    if (!id) {
      if (!engine) throw new Error('Local player is not ready')
      engine.getState().setPlayMode('random')
      await engine.getState().playAll(songs)
    } else {
      await outputApi.transport(id, '', { repeat: 'off', shuffle: true })
      await outputApi.replaceQueue(id, songs.map(song => song.id), Math.floor(Math.random() * songs.length))
      await outputApi.transport(id, 'play')
      await refreshOutputs()
    }
  }
}
export async function prepareCollectionShuffle() {
  const group = remoteGroup()
  if (group) {
    await outputApi.transport(group.id, '', { repeat: 'off', shuffle: true })
    await refreshOutputs()
  } else local?.getState().setPlayMode('random')
}
const routedActions: Partial<PlayerState> = {}
function localUserAction<T>(action: () => T): T {
  commandGeneration++
  explicitStopped = false
  if (suppressQueue) local?.getState().cancelPendingPlayback()
  return action()
}
/** The display store routes user actions; engine callbacks retain the local store. */
export function createZonePlayer(engine: UseBoundStore<StoreApi<PlayerState>>): UseBoundStore<StoreApi<PlayerState>> {
  local = engine
  const facade = create<PlayerState>(() => engine.getState())
  display = { ...facade, setState: facade.setState }
  const syncActions = ['addToPlaylist', 'insertNextInQueue', 'insertToPlaylist', 'reorderPlaylist', 'clearPlaylist'] as const
  for (const name of syncActions) {
    Object.assign(routedActions, { [name]: (...args: unknown[]) => {
      if (!remoteGroup()) return (engine.getState()[name] as (...a: unknown[]) => unknown)(...args)
      const s = facade.getState(), songs = [...s.playlist]; let index = s.currentIndex
      if (name === 'clearPlaylist') { const id = remoteGroup()!.id; void outputAction(async () => { await outputApi.transport(id, 'stop'); await outputApi.replaceQueue(id, [], -1) }); return }
      if (name === 'addToPlaylist' || name === 'insertNextInQueue') { const append = createQueueAppender(name === 'addToPlaylist' ? 'end' : 'next'); void outputAction(() => append(args[0] as Song[])); return }
      if (name === 'insertToPlaylist') { const at = args[0] as number; songs.splice(at, 0, args[1] as Song); if (at <= index) index++ }
      if (name === 'reorderPlaylist') {
        const from = args[0] as number, raw = args[1] as number, to = raw > from ? raw - 1 : raw
        if (from < 0 || from >= songs.length || to < 0 || to >= songs.length) return
        const id = remoteGroup()!.id
        void outputAction(() => outputApi.request(`/groups/${outputId(id)}/queue/reorder`, 'PUT', { from, to }))
        return
      }
      void outputAction(() => remoteQueue(songs, index, false))
    } })
  }
  Object.assign(routedActions, {
    playSong: (song: Song, queue?: Song[]) => remoteGroup() ? remoteQueue(queue ?? [song], queue?.findIndex(s => s.id === song.id) ?? 0, true) : localUserAction(() => engine.getState().playSong(song, queue)),
    playPlaylist: (songs: Song[], index = 0, context?: Parameters<PlayerState['playPlaylist']>[2]) => remoteGroup() ? remoteQueue(songs, index, true) : localUserAction(() => engine.getState().playPlaylist(songs, index, context)),
    playAll: (songs: Song[], context?: Parameters<PlayerState['playAll']>[1]) => remoteGroup() ? remoteQueue(songs, facade.getState().playMode === 'random' ? Math.floor(Math.random() * songs.length) : 0, true) : localUserAction(() => engine.getState().playAll(songs, context)),
    playQueueIndex: (index: number) => remoteGroup() ? remoteQueue(facade.getState().playlist, index, true) : localUserAction(() => engine.getState().playQueueIndex(index)),
    playSongNext: async (song: Song) => {
      if (!remoteGroup()) return engine.getState().playSongNext(song)
      await outputApi.request(`/groups/${outputId(remoteGroup()!.id)}/queue`, 'POST', { song_ids: [song.id], position: 'next' }); await refreshOutputs()
    },
    togglePlay: () => remoteGroup() ? remoteTransport(facade.getState().isPlaying ? 'pause' : 'play') : localUserAction(() => engine.getState().togglePlay()),
    playNext: () => remoteGroup() ? remoteTransport('next') : localUserAction(() => engine.getState().playNext()),
    playPrev: () => remoteGroup() ? remoteTransport('prev') : localUserAction(() => engine.getState().playPrev()),
    setSpeed: async (rate: number) => { if (!remoteGroup()) await engine.getState().setSpeed(rate) },
    setAudioTrack: async (index: number | null) => { if (!remoteGroup()) await engine.getState().setAudioTrack(index) },
    enterVideoSource: async () => remoteGroup() ? 'skipped' : engine.getState().enterVideoSource(),
    setSleepTimerAfterSongs: (count: number) => { if (remoteGroup()) openOutputPanel('sleep'); else engine.getState().setSleepTimerAfterSongs(count) },
    seek: (ms: number) => remoteGroup() ? remoteTransport('seek', { position: ms / 1000 }) : engine.getState().seek(ms),
    seekBy: (ms: number) => facade.getState().seek(Math.max(0, facade.getState().currentTime + ms)),
    setVolume: async (v: number) => {
      if (!remoteGroup()) return engine.getState().setVolume(v)
      await outputApi.groupVolume(remoteGroup()!.id, v); await refreshOutputs()
    },
    toggleMute: () => remoteGroup() ? facade.getState().setVolume(facade.getState().volume ? 0 : 20) : engine.getState().toggleMute(),
    setPlayMode: (mode: PlayerState['playMode']) => {
      if (!remoteGroup()) return engine.getState().setPlayMode(mode)
      void outputAction(() => remoteTransport('', { repeat: mode === 'loop' ? 'all' : mode === 'single' ? 'one' : 'off', shuffle: mode === 'random' }))
    },
    cyclePlayMode: () => {
      if (!remoteGroup()) return engine.getState().cyclePlayMode()
      const modes: PlayerState['playMode'][] = ['order', 'loop', 'single', 'random']
      facade.getState().setPlayMode(modes[(modes.indexOf(facade.getState().playMode) + 1) % modes.length]!)
    },
    removeFromPlaylist: async (index: number) => {
      if (!remoteGroup()) return engine.getState().removeFromPlaylist(index)
      const id = remoteGroup()!.id
      await outputAction(() => outputApi.request(`/groups/${outputId(id)}/queue/reorder`, 'PUT', { remove_index: index }))
    },
    setSleepTimerByDuration: (ms: number) => {
      if (!remoteGroup()) return engine.getState().setSleepTimerByDuration(ms)
      void outputAction(() => outputApi.sleep(remoteGroup()!.id, Math.ceil(ms / 60_000)))
    },
    cancelSleepTimer: () => {
      if (!remoteGroup()) return engine.getState().cancelSleepTimer()
      void outputAction(() => outputApi.sleep(remoteGroup()!.id, 0))
    },
    loadRemainingSongsForCurrentPlaylist: (params: Parameters<PlayerState['loadRemainingSongsForCurrentPlaylist']>[0]) => {
      if (!remoteGroup()) return engine.getState().loadRemainingSongsForCurrentPlaylist(params)
      const id = remoteGroup()!.id
      void (async () => {
        let offset = params.loadedCount
        while (offset < params.total && remoteGroup()?.id === id) {
          const page = await params.fetch(offset, 200)
          if (remoteGroup()?.id !== id || !page.length) return
          await remoteQueue([...facade.getState().playlist, ...page], facade.getState().currentIndex, false); offset += page.length
        }
      })().catch(e => useZoneState.setState({ error: String(e) }))
    },
  } satisfies Partial<PlayerState>)
  engine.subscribe(() => { publishDisplay(); scheduleLocalQueue() })
  publishDisplay()
  facade.setState = engine.setState
  return facade
}

let connection: PlaybackConnection | null = null
let stopRuntime: (() => void) | null = null
let runtimeGeneration = 0
let suppressQueue = 0
let queueTimer: ReturnType<typeof setTimeout> | null = null
let lastLocalQueue = ''
let observedLocalQueue: { playlist: Song[]; index: number; group: string } | null = null
function scheduleLocalQueue() {
  if (suppressQueue || !local || !connection || !useZoneState.getState().connected) return
  const group = localGroup(); if (!group) return
  const s = local.getState()
  // Progress arrives four times a second. Immutable queues need encoding only
  // when their identity, index or group changes, not on every audio tick.
  if (observedLocalQueue?.playlist === s.playlist && observedLocalQueue.index === s.currentIndex && observedLocalQueue.group === group.id) return
  observedLocalQueue = { playlist: s.playlist, index: s.currentIndex, group: group.id }
  const key = `${group.id}:${s.playlist.map(s => s.id)}:${s.currentIndex}`
  if (lastLocalQueue === key) return
  lastLocalQueue = key
  if (queueTimer) clearTimeout(queueTimer)
  const id = group.id, ids = s.playlist.map(s => s.id), index = s.currentIndex
  queueTimer = setTimeout(() => { queueTimer = null; void outputApi.replaceQueue(id, ids, index).catch(e => useZoneState.setState({ error: String(e) })) }, 200)
}
let commandGeneration = 0
let explicitStopped = false
let serverOffsetMs = 0
let pendingLoad: Promise<void> = Promise.resolve()
async function handleCommand(message: Record<string, unknown>) {
  if (!local) return
  if (typeof message.time_ms === 'number') serverOffsetMs = Date.now() - message.time_ms
  const command = message.cmd
  if (typeof command !== 'string') { void refreshOutputs().catch(() => {}); return }
  if (!localGroup()) return
  if (command === 'stop' || command === 'pause') {
    explicitStopped = command === 'stop'
    commandGeneration++; local.getState().cancelPendingPlayback()
    await (command === 'stop' ? getAudio().stop() : getAudio().pause())
    local.setState({ isPlaying: false, isBuffering: false }); return
  }
  if (command === 'load') {
    explicitStopped = false
    const generation = ++commandGeneration
    local.getState().cancelPendingPlayback()
    if (queueTimer) { clearTimeout(queueTimer); queueTimer = null }
    observedLocalQueue = null
    pendingLoad = (async () => {
      suppressQueue++
      try {
        // Membership changes before its WS event: discard the old solo-group cache.
        const outputs = await refreshOutputs()
        if (generation !== commandGeneration) return
        const g = outputs.groups.find(g => g.members.some(m => m.player_id === useZoneState.getState().deviceId))
        if (!g) return
        const status = await outputApi.getQueue(g.id)
        const songs = await outputApi.songs(status.queue.items)
        if (generation !== commandGeneration || songs[status.queue.current]?.id !== message.song_id) return
        await local!.getState().loadZoneQueue({ songs, index: status.queue.current, positionMs: Number(message.position_ms ?? 0) })
        lastLocalQueue = `${g.id}:${songs.map(s => s.id)}:${status.queue.current}`
      } finally { suppressQueue-- }
    })()
    await pendingLoad; return
  }
  if (command === 'play') {
    const generation = commandGeneration
    await pendingLoad
    const delay = Number(message.play_at_ms ?? 0) + serverOffsetMs - Date.now()
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, 30_000)))
    if (generation === commandGeneration) { explicitStopped = false; await getAudio().play() }
  }
  if (command === 'seek') await local.getState().seek(Number(message.position_ms ?? 0))
  if (command === 'volume') await local.getState().setVolume(Number(message.volume ?? 0))
  if (command === 'skip') await (message.direction === 'prev' ? local.getState().playPrev() : local.getState().playNext())
}
export async function startOutputRuntime(): Promise<() => void> {
  stopRuntime?.()
  const generation = ++runtimeGeneration
  let stopped = false, timer: ReturnType<typeof setTimeout> | null = null
  const session = useAppSessionStore.getState().baseUrl
  const storage = getSongloftStorage().prefs
  let id = await storage.get('roomtone.local-device-id')
  if (!id) { id = `lynx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; await storage.set('roomtone.local-device-id', id) }
  if (generation !== runtimeGeneration || session !== useAppSessionStore.getState().baseUrl) return () => {}
  useZoneState.setState({ deviceId: id })
  await refreshOutputs().catch(e => useZoneState.setState({ error: String(e) }))
  if (generation !== runtimeGeneration || session !== useAppSessionStore.getState().baseUrl) return () => {}
  const active = () => !stopped && generation === runtimeGeneration && session === useAppSessionStore.getState().baseUrl
  // A persisted local queue can predate edits made before this client opened.
  // Refresh its current song once, without replacing/reloading the audio queue.
  const restoredSong = local?.getState().currentSong
  if (restoredSong && !('deviceCache' in restoredSong)) {
    void outputApi.songs([restoredSong.id]).then(songs => {
      if (active() && songs[0]) updateOutputSong(songs[0])
    }).catch(() => {})
  }
  const connect = async () => {
    if (!active()) return
    try {
      const ticket = (await getSharedClient().post<{ ticket: string }>(`${apiPrefix}/playback/events/ticket`)).data.ticket
      if (!active()) return
      let lastSequence = 0
      connection = await connectPlaybackSocket(ticket, {
        open: () => {
          if (!active()) return
          useZoneState.setState({ connected: true, error: '' })
          connection?.send({ type: 'register_player', id, kind: 'local', name: getPlatformTarget() === 'web' ? 'Lynx Web' : `Lynx ${getPlatformTarget()}`, caps: { codecs: ['flac', 'mp3', 'aac', 'wav'], sample_rates: [44100, 48000] } })
          void refreshOutputs().catch(() => {})
        },
        message: message => {
          if (!active() || !message || typeof message !== 'object') return
          if (typeof message.seq === 'number' && message.seq > 0) {
            if (message.seq <= lastSequence) return
            lastSequence = message.seq
          }
          void handleCommand(message).catch(e => useZoneState.setState({ error: String(e) }))
        },
        close: () => { useZoneState.setState({ connected: false }); if (active()) timer = setTimeout(() => void connect(), 3000) },
      })
    } catch (e) { if (active()) { useZoneState.setState({ error: String(e), connected: false }); timer = setTimeout(() => void connect(), 5000) } }
  }
  void connect()
  let heartbeat: ReturnType<typeof setTimeout> | null = null
  const beat = () => {
    if (!active()) return
    const state = local?.getState()
    if (state?.isPlaying) explicitStopped = false
    if (state && !suppressQueue) connection?.send({ type: 'report', id, song_id: explicitStopped ? 0 : state.currentSong?.id ?? 0, position_ms: explicitStopped ? 0 : state.currentTime, volume: Math.round(state.volume), buffering: state.isBuffering, state: state.isPlaying ? 'playing' : explicitStopped ? 'idle' : state.currentSong ? 'paused' : 'idle', rtt_ms: 0 })
    heartbeat = setTimeout(beat, 500)
  }
  beat()
  const poll = setInterval(() => { if (active()) void refreshOutputs().catch(() => {}) }, 2000)
  stopRuntime = () => {
    if (generation !== runtimeGeneration) return
    stopped = true; commandGeneration++; refreshGeneration++; adoptGeneration++
    if (timer) clearTimeout(timer)
    if (heartbeat) clearTimeout(heartbeat)
    if (queueTimer) { clearTimeout(queueTimer); queueTimer = null }
    observedLocalQueue = null
    clearInterval(poll)
    connection?.send({ type: 'unregister_player', id }); connection?.close(); connection = null
    useZoneState.setState({ connected: false, focus: null, panel: null }); publishDisplay()
  }
  return stopRuntime
}
