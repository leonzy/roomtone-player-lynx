import { z } from 'zod'
import { getSharedClient } from '../../core/network/api-client.js'
import { apiPrefix } from '../../core/config/app-config.js'
import { parseSong, type Song } from '../../models/song.js'

const eq = z.object({ enabled: z.boolean().default(false), preset: z.string().default(''), bands: z.array(z.number()).nullish().transform(value => value ?? Array(10).fill(0)), preamp: z.number().default(0) })
const caps = z.object({ supports_volume: z.boolean().default(false), supports_seek: z.boolean().default(false), sync_tier: z.string().default('none'), airplay2: z.boolean().default(false), needs_password: z.boolean().default(false) }).passthrough()
const device = z.object({ ID: z.string(), Name: z.string(), Kind: z.string(), Address: z.string().default(''), Model: z.string().default(''), Online: z.boolean().default(false), Volume: z.number().default(0), Muted: z.boolean().default(false), Caps: caps.prefault({}), EQ: eq.prefault({}), volume_mode: z.string().default('device'), max_volume: z.number().default(100), standby: z.boolean().default(false), Takeover: z.string().default('pause') })
const queue = z.object({ items: z.array(z.number()).nullish().transform(value => value ?? []), current: z.number().default(-1), repeat: z.string().default('off'), shuffle: z.boolean().default(false) })
const status = z.object({ song_id: z.number().default(0), position: z.number().default(0), state: z.string().default('idle'), error: z.string().optional(), queue: queue.prefault({}), underruns: z.number().default(0) }).passthrough()
const member = z.object({ player_id: z.string(), delay_ms: z.number().default(0), volume_offset: z.number().default(0), position: z.number().default(0) })
const group = z.object({ id: z.string(), name: z.string(), icon: z.string().default(''), master_id: z.string(), members: z.array(member), status: status.prefault({}), sync_tier: z.string().default('none'), party_id: z.string().optional(), signal_path: z.object({ kind: z.string(), stages: z.array(z.object({ name: z.string(), detail: z.string() })) }).optional() })
export type OutputDevice = z.infer<typeof device>
export type OutputGroup = z.infer<typeof group>
export type OutputStatus = z.infer<typeof status>
export type EqProfile = z.infer<typeof eq>
export interface Outputs { players: OutputDevice[]; groups: OutputGroup[] }
export const volumeInt = (v: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)))
// Chi uses raw route params. Preserve colons in stable RAOP IDs.
export const outputId = (id: string) => encodeURIComponent(id).replace(/%3A/gi, ':')

export class OutputApi {
  constructor(private client = getSharedClient()) {}
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return (await this.client.request<T>(`${apiPrefix}${path}`, { method, body })).data
  }
  async outputs(): Promise<Outputs> {
    const [p, g] = await Promise.all([this.request('/players'), this.request('/playback')])
    return { players: z.array(device).parse(p ?? []), groups: z.array(group).parse(g ?? []) }
  }
  async getQueue(id: string) { return status.parse(await this.request(`/groups/${outputId(id)}/queue`)) }
  async songs(ids: number[]): Promise<Song[]> {
    if (!ids.length) return []
    const unique = [...new Set(ids)], songs = new Map<number, Song>()
    // The server accepts at most 500 IDs per request. Keep duplicate queue
    // entries and ordering when reconstructing queues of any size.
    for (let offset = 0; offset < unique.length; offset += 200) {
      const data = await this.request<{ songs: unknown[] }>(`/songs/batch?ids=${unique.slice(offset, offset + 200).join(',')}`)
      for (const raw of data.songs) { const song = parseSong(raw); songs.set(song.id, song) }
    }
    return ids.map(id => { const song = songs.get(id); if (!song) throw new Error('Queue contains unavailable songs'); return song })
  }
  async replaceQueue(id: string, ids: number[], index: number) { return status.parse(await this.request(`/groups/${outputId(id)}/queue`, 'PUT', { song_ids: ids, index })) }
  async transport(id: string, action: string, extra: Record<string, unknown> = {}) { return status.parse(await this.request(`/groups/${outputId(id)}/transport`, 'POST', { action, ...extra })) }
  discover() { return this.request('/players/discover', 'POST', {}) }
  transfer(from: string, to: string, onlyPlayerId?: string) { return this.request(`/groups/${outputId(to)}/transfer`, 'POST', { from_group_id: from, ...(onlyPlayerId ? { only_player_id: onlyPlayerId } : {}) }) }
  renameDevice(id: string, name: string) { return this.updateDevice(id, { name }) }
  updateDevice(id: string, patch: Record<string, unknown>) { return this.request(`/players/${outputId(id)}`, 'PUT', patch) }
  updateGroup(id: string, patch: Record<string, unknown>) { return this.request(`/groups/${outputId(id)}`, 'PUT', patch) }
  setVolume(id: string, volume: number, muted = false) { return this.request(`/players/${outputId(id)}/volume`, 'POST', { volume: volumeInt(volume), muted }) }
  groupVolume(id: string, volume: number, muted = false) { return this.request(`/groups/${outputId(id)}/volume`, 'POST', { volume: volumeInt(volume), muted }) }
  async setEq(id: string, profile: EqProfile) { return eq.parse(await this.request(`/players/${outputId(id)}/eq`, 'PUT', profile)) }
  member(id: string, playerId: string, method: string, patch?: unknown) { return this.request(`/groups/${outputId(id)}/members${method === 'POST' ? '' : '/' + outputId(playerId)}`, method, method === 'POST' ? { player_id: playerId } : patch) }
  sleep(id: string, minutes?: number) { return this.request<{ remaining_seconds: number; active: boolean }>(`/groups/${outputId(id)}/sleep`, minutes == null ? 'GET' : 'POST', minutes == null ? undefined : { minutes }) }
}

export const outputApi = new OutputApi()
