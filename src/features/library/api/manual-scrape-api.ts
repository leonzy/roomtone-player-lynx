import { z } from 'zod'
import { apiPrefix } from '../../../core/config/app-config.js'
import { getSharedApiBundle } from '../../../core/network/api-client.js'
import { ApiError, type HttpClient } from '../../../core/network/http-client.js'
import { parseSong } from '../../../models/song.js'

const resultSchema = z.object({
  songId: z.number().int().positive(), title: z.string().trim().min(1),
  artist: z.string(), album: z.string(), source: z.string(), score: z.number().finite(),
  genre: z.string().optional(), year: z.coerce.string().optional(), track: z.coerce.string().optional(),
  lyrics: z.string().optional(), cover_url: z.string().optional(),
  score_threshold: z.number().finite().optional(), below_threshold: z.boolean().optional(),
  diagnostics: z.array(z.string()).optional(),
})
export type ScrapeResult = z.infer<typeof resultSchema>
export class ScrapeUnavailableError extends Error {
  constructor(readonly reason: 'notInstalled' | 'disabled' | 'upgradeRequired') { super(reason) }
}

export class ManualScrapeApi {
  constructor(private client: HttpClient) {}

  async prepare(id: number): Promise<ScrapeResult> {
    const plugins = await this.client.get<{ plugins?: { entry_path: string; status: string }[] }>(`${apiPrefix}/jsplugins`)
    const plugin = plugins.data?.plugins?.find(p => p.entry_path === 'tag')
    if (!plugin) throw new ScrapeUnavailableError('notInstalled')
    if (plugin.status !== 'active') throw new ScrapeUnavailableError('disabled')
    try {
      const response = await this.client.post<{ result?: unknown }>(`${apiPrefix}/jsplugin/tag/scrape/prepare/${id}`, {}, { receiveTimeoutMs: 120_000 })
      const result = resultSchema.parse(response.data?.result)
      if (result.songId !== id) throw new Error('Scrape result belongs to a different song')
      return result
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) throw new ScrapeUnavailableError('upgradeRequired')
      throw error
    }
  }

  async save(id: number, preview: ScrapeResult) {
    const result = resultSchema.parse(preview)
    if (result.songId !== id) throw new Error('Scrape result belongs to a different song')
    const year = Number.parseInt(result.year ?? '', 10)
    const response = await this.client.put<{ song: unknown; file_write?: string }>(`${apiPrefix}/songs/${id}/tags`, {
      title: result.title, artist: result.artist, album: result.album,
      genre: result.genre, year: Number.isFinite(year) ? year : undefined,
      track: result.track, lyrics: result.lyrics, cover_url: result.cover_url,
    }, { receiveTimeoutMs: 120_000 })
    return { song: parseSong(response.data?.song), fileWrite: response.data?.file_write }
  }
}

export function getManualScrapeApi() { return new ManualScrapeApi(getSharedApiBundle().client) }
