import { expect, test } from 'vitest'
import { createPublicClient } from '../../../core/network/api-client.js'
import { ManualScrapeApi } from '../api/manual-scrape-api.js'
import type { Transport } from '../../../core/network/http-client.js'

const match = { songId: 42, title: 'Matched', artist: 'Artist', album: 'Album', source: 'netease', score: 0.94, year: '2020' }
function harness(status = 'active', installed = true) {
  const calls: { url: string; method: string; body?: unknown }[] = []
  const transport: Transport = async request => {
    calls.push(request)
    const data = request.url.endsWith('/jsplugins')
      ? { plugins: installed ? [{ entry_path: 'tag', status }] : [] }
      : request.method === 'POST' ? { result: match } : { song: { id: 42, type: 'local', title: 'Matched' }, file_write: 'written' }
    return { status: 200, headers: {}, body: JSON.stringify(data) }
  }
  return { calls, api: new ManualScrapeApi(createPublicClient({ transport, getBaseUrl: () => 'http://test' })) }
}

test('prepare uses the preview-only plugin route and never writes tags', async () => {
  const h = harness()
  expect(await h.api.prepare(42)).toMatchObject(match)
  expect(h.calls.map(c => c.method)).toEqual(['GET', 'POST'])
  expect(h.calls[1].url).toBe('http://test/api/v1/jsplugin/tag/scrape/prepare/42')
  expect(h.calls.some(c => c.method === 'PUT')).toBe(false)
})

test.each([['inactive', true, 'disabled'], ['active', false, 'notInstalled']] as const)('reports unavailable plugin before scraping', async (status, installed, reason) => {
  const h = harness(status, installed)
  await expect(h.api.prepare(42)).rejects.toMatchObject({ reason })
  expect(h.calls).toHaveLength(1)
})

test('save rejects another song and whitelists tag fields', async () => {
  const h = harness()
  await expect(h.api.save(43, match)).rejects.toThrow('different song')
  expect(h.calls).toHaveLength(0)
  await h.api.save(42, match)
  expect(h.calls[0].method).toBe('PUT')
  expect(JSON.parse(String(h.calls[0].body))).toMatchObject({ title: 'Matched', year: 2020 })
  expect(JSON.parse(String(h.calls[0].body))).not.toHaveProperty('source')
})
