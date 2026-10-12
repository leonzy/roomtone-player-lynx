import { expect, test, vi } from 'vitest'
import { HttpClient, type Transport } from '../../../core/network/http-client.js'
import { parseJSPlugin, registryPluginEntrySchema } from '../../../models/jsplugin.js'
import { ClientRegistryApi, compareRegistryVersions, registryIdentity } from '../api/client-registry-api.js'
import { JSPluginApi } from '../api/jsplugin-api.js'

const root = 'https://raw.githubusercontent.com/alice/store/main/registry.json'
const manifestUrl = (name: string) => `https://raw.githubusercontent.com/alice/store/main/${name}.json`
const manifest = (name: string, version = '1.0.0', author = 'Alice') => ({
  name, entryPath: name, version, author, download_url: `https://github.com/alice/store/releases/download/v1/${name}.jsplugin.zip`,
})
const source = { url: root, name: 'Main', enabled: true }
const parseRegistryPluginEntry = (value: unknown) => registryPluginEntrySchema.parse(value)
function fixture(routes: Record<string, unknown>, options: { web?: boolean; token?: string; githubToken?: () => Promise<string> } = {}) {
  const backend = {
    getPluginRegistries: vi.fn(async () => [{ ...source, token: options.token }]),
    getPlugins: vi.fn(async () => ({ plugins: [] as ReturnType<typeof parseJSPlugin>[] })),
    refreshRegistry: vi.fn(async () => ({ plugins: [] as ReturnType<typeof parseRegistryPluginEntry>[], total: 0, page: 1, pageSize: 100, warnings: [] as string[] })),
  }
  const transport = vi.fn<Transport>(async request => {
    const original = request.url.replace(/^https:\/\/mirror.test\//, '')
    const body = routes[original]
    if (body instanceof Error) throw body
    if (typeof body === 'function') return (body as () => Promise<unknown>)().then(value => ({ status: 200, headers: {}, body: JSON.stringify(value) }))
    return { status: body === undefined ? 404 : 200, headers: {}, body: JSON.stringify(body ?? {}) }
  })
  const api = new ClientRegistryApi({ backend: () => backend as unknown as JSPluginApi, transport, web: options.web ?? false, githubToken: options.githubToken })
  const input = { allSources: true, registries: [{ ...source, token: options.token }] }
  return { api, input, backend, transport }
}

test('shows a resolved plugin before a slow sibling and recursive source finish', async () => {
  let release!: (data: unknown) => void
  const delayed = new Promise(resolve => { release = resolve })
  const f = fixture({ [root]: { plugins: [manifestUrl('fast'), manifestUrl('slow')], includes: [manifestUrl('include')] },
    [manifestUrl('fast')]: manifest('fast'), [manifestUrl('slow')]: () => delayed,
    [manifestUrl('include')]: { plugins: [manifestUrl('third')], includes: [root] }, [manifestUrl('third')]: manifest('third') })
  const progress: string[][] = []
  let complete = false
  const pending = f.api.refreshRegistry({ ...f.input, onProgress: page => progress.push(page.plugins.map(plugin => plugin.name)) }).then(value => { complete = true; return value })
  for (let i = 0; i < 40; i++) await Promise.resolve()
  expect(complete).toBe(false)
  expect(progress.some(page => page.includes('fast'))).toBe(true)
  release(manifest('slow'))
  const result = await pending
  expect(result.plugins.map(plugin => plugin.name).sort()).toEqual(['fast', 'slow', 'third'])
  expect(f.backend.refreshRegistry).not.toHaveBeenCalled()
})

test('source and proxy credentials stay out of cross-origin includes and anonymous requests', async () => {
  const foreign = 'https://public.test/registry.json', foreignPlugin = 'https://public.test/plugin.json'
  const f = fixture({ [root]: { plugins: [manifestUrl('private')], includes: [foreign] },
    [manifestUrl('private')]: manifest('private'), [foreign]: { plugins: [foreignPlugin] }, [foreignPlugin]: manifest('public') }, { token: 'ghp_private' })
  const result = await f.api.refreshRegistry({ ...f.input, githubProxy: 'https://mirror.test/' })
  expect(result.plugins).toHaveLength(2)
  for (const [request] of f.transport.mock.calls) {
    const own = request.url.startsWith('https://raw.githubusercontent.com/')
    expect(request.headers.Authorization).toBe(own ? 'Bearer ghp_private' : undefined)
    expect(request.url).not.toContain('mirror.test')
    expect(request.url).not.toContain('ghp_private')
  }
})

test('merges higher versions by normalized identity and preserves other authors and installed conflicts', async () => {
  const f = fixture({ [root]: { plugins: [manifestUrl('old'), manifestUrl('new'), manifestUrl('other')] },
    [manifestUrl('old')]: { ...manifest('music'), version: '1.0.0', author: ' Alice <a@x> ' },
    [manifestUrl('new')]: { ...manifest('music'), version: '2.0.0', author: 'ALICE (maintainer)' },
    [manifestUrl('other')]: { ...manifest('music'), version: '3.0.0', author: 'Bob' } })
  f.backend.getPlugins.mockResolvedValue({ plugins: [parseJSPlugin({ id: 1, name: 'Installed', entry_path: 'music', author: 'alice', version: '1.0.0' })] })
  const result = await f.api.refreshRegistry(f.input)
  expect(result.plugins).toHaveLength(2)
  expect(result.plugins.find(plugin => plugin.identity === 'alice')).toMatchObject({ version: '2.0.0', installed: true, hasUpdate: true, conflict: false, sourceUrl: root })
  expect(result.plugins.find(plugin => plugin.identity === 'bob')).toMatchObject({ installed: false, conflict: true, hasUpdate: false })
})

test('source token wins over shared token; shared token only authenticates the official API directly', async () => {
  const apiRoot = 'https://api.github.com/registry.json', apiPlugin = 'https://api.github.com/plugin.json'
  const f = fixture({ [apiRoot]: { plugins: [apiPlugin, manifestUrl('public')] }, [apiPlugin]: manifest('api'), [manifestUrl('public')]: manifest('public') })
  for (const token of ['ghp_source', '']) {
    f.transport.mockClear()
    expect((await f.api.refreshRegistry({ allSources: true, registries: [{ url: apiRoot, token }], githubToken: 'ghp_shared', githubProxy: 'https://mirror.test/' })).plugins).toHaveLength(2)
    for (const [request] of f.transport.mock.calls) {
      if (token) {
        expect(request.headers.Authorization).toBe('Bearer ghp_source')
        expect(request.url).not.toContain('mirror.test')
      } else if (request.url.startsWith('https://api.github.com/')) {
        expect(request.headers.Authorization).toBe('Bearer ghp_shared')
        expect(request.redirect).toBe('error')
      } else {
        expect(request.headers.Authorization).toBeUndefined()
        expect(request.url).toContain('mirror.test')
      }
    }
  }
})

test('failed shared setting reads do not block a source with its own credential or expose error contents', async () => {
  const f = fixture({ [root]: { plugins: [manifestUrl('private')] }, [manifestUrl('private')]: manifest('private') },
    { token: 'ghp_source', githubToken: async () => { throw new Error('ghp_do_not_log') } })
  const result = await f.api.refreshRegistry(f.input)
  expect(result.plugins).toHaveLength(1)
  expect(result.warnings).toEqual(['Could not read GitHub token setting.'])
  expect(f.transport.mock.calls.every(([request]) => request.headers.Authorization === 'Bearer ghp_source')).toBe(true)
})

test('force refresh returns current source credentials for later cached pages', async () => {
  const f = fixture({ [root]: { plugins: [manifestUrl('private')] }, [manifestUrl('private')]: manifest('private') }, { token: 'ghp_old' })
  await f.api.refreshRegistry(f.input)
  f.backend.getPluginRegistries.mockResolvedValue([{ ...source, token: 'ghp_new' }])
  f.transport.mockClear()
  let current = f.input.registries
  await f.api.refreshRegistry({ ...f.input, force: true, onSources: sources => { current = sources as typeof current } })
  expect(current[0]?.token).toBe('ghp_new')
  expect(f.transport.mock.calls.every(([request]) => request.headers.Authorization === 'Bearer ghp_new')).toBe(true)
  const count = f.transport.mock.calls.length
  await f.api.refreshRegistry({ ...f.input, registries: current, page: 2 })
  expect(f.transport).toHaveBeenCalledTimes(count)
})

test('client requests respect the eight-request concurrency limit', async () => {
  const urls = Array.from({ length: 25 }, (_, i) => manifestUrl(`plugin${i}`))
  let active = 0, maximum = 0
  const routes = Object.fromEntries(urls.map((url, i) => [url, async () => {
    maximum = Math.max(maximum, ++active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active--
    return manifest(`plugin${i}`)
  }]))
  const f = fixture({ [root]: { plugins: urls }, ...routes })
  expect((await f.api.refreshRegistry({ ...f.input, pageSize: 100 })).plugins).toHaveLength(25)
  expect(maximum).toBe(8)
})

test.each([false, true])('force refresh stops using a removed or disabled source credential (disabled=%s)', async disabled => {
  const remaining = { url: 'https://public.test/registry.json', name: 'Remaining', token: undefined, enabled: true }
  const plugin = 'https://public.test/plugin.json'
  const f = fixture({ [remaining.url]: { plugins: [plugin] }, [plugin]: manifest('remaining') }, { token: 'ghp_old' })
  f.backend.getPluginRegistries.mockResolvedValue(disabled ? [remaining, { ...source, token: 'ghp_old', enabled: false }] : [remaining])
  const result = await f.api.refreshRegistry({ ...f.input, allSources: false, registryUrl: root, token: 'ghp_old', force: true })
  expect(result.plugins.map(entry => entry.entryPath)).toEqual(['remaining'])
  expect(f.transport.mock.calls.every(([request]) => request.url.startsWith('https://public.test/') && !request.headers.Authorization)).toBe(true)
})

test('search and pagination use client cache while installed status refreshes from the server', async () => {
  const urls = Array.from({ length: 25 }, (_, i) => manifestUrl(`music${i}`))
  const routes = Object.fromEntries(urls.map((url, i) => [url, manifest(`music${i}`)]))
  const f = fixture({ [root]: { plugins: urls }, ...routes })
  expect((await f.api.refreshRegistry(f.input)).plugins).toHaveLength(20)
  const requests = f.transport.mock.calls.length
  expect((await f.api.refreshRegistry({ ...f.input, page: 2 })).plugins).toHaveLength(5)
  f.backend.getPlugins.mockResolvedValue({ plugins: [parseJSPlugin({ id: 1, entry_path: 'music24', author: 'Alice', version: '1.0.0' })] })
  expect((await f.api.refreshRegistry({ ...f.input, search: 'music24' })).plugins[0]?.installed).toBe(true)
  expect(f.transport).toHaveBeenCalledTimes(requests)
  await f.api.refreshRegistry({ ...f.input, force: true })
  expect(f.transport.mock.calls.length).toBeGreaterThan(requests)
})

test('a successful empty force refresh replaces the previous cache instead of resurrecting deleted entries', async () => {
  const routes: Record<string, unknown> = { [root]: { plugins: [manifestUrl('old')] }, [manifestUrl('old')]: manifest('old') }
  const f = fixture(routes)
  expect((await f.api.refreshRegistry(f.input)).plugins).toHaveLength(1)
  routes[root] = { plugins: [] }
  expect((await f.api.refreshRegistry({ ...f.input, force: true })).total).toBe(0)
  const count = f.transport.mock.calls.length
  expect((await f.api.refreshRegistry({ ...f.input, search: 'old' })).total).toBe(0)
  expect(f.transport).toHaveBeenCalledTimes(count)
})

test('browser CORS fallback uses the existing backend reader and never supplies a proxy with a token', async () => {
  const f = fixture({ [root]: new TypeError('CORS') }, { web: true, token: 'ghp_private' })
  f.backend.refreshRegistry.mockResolvedValue({ plugins: [parseRegistryPluginEntry({ name: 'Fallback', entry_path: 'fallback', version: '1.0.0', download_url: 'https://github.com/a/b/releases/download/v1/pkg.zip' })], total: 1, page: 1, pageSize: 100, warnings: [] })
  expect((await f.api.refreshRegistry({ ...f.input, githubProxy: 'https://mirror.test/' })).plugins[0]?.name).toBe('Fallback')
  expect(f.backend.refreshRegistry).toHaveBeenCalledWith(expect.objectContaining({ registryUrl: root, token: 'ghp_private', githubProxy: undefined }))
})

test('a private Web fallback cannot send its source credential to another server while authentication waits', async () => {
  let baseUrl = 'https://first.test/music', release!: () => void, authStarted!: () => void
  const authentication = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { authStarted = resolve })
  const transport = vi.fn<Transport>()
  const backend = new JSPluginApi(new HttpClient({ getBaseUrl: () => baseUrl, transport,
    interceptor: { onRequest: () => { authStarted(); return authentication } } }))
  vi.spyOn(backend, 'getPlugins').mockResolvedValue({ plugins: [] })
  const api = new ClientRegistryApi({ backend: () => backend, transport: async () => { throw new Error('CORS') },
    web: true, serverBaseUrl: () => baseUrl })
  const pending = api.refreshRegistry({ allSources: true, registries: [{ ...source, token: 'ghp_private' }] })
  const rejected = expect(pending).rejects.toThrow('Server changed')
  await started
  baseUrl = 'https://second.test/music'
  release()
  await rejected
  expect(transport).not.toHaveBeenCalled()
})

test('native errors and invalid JSON remain partial warnings, and abort stops late progress', async () => {
  const f = fixture({ [root]: { plugins: [manifestUrl('good'), manifestUrl('bad')] }, [manifestUrl('good')]: manifest('good'), [manifestUrl('bad')]: { broken: true } })
  const result = await f.api.refreshRegistry(f.input)
  expect(result.plugins).toHaveLength(1)
  expect(result.warnings).toHaveLength(1)
  expect(f.backend.refreshRegistry).not.toHaveBeenCalled()
  const controller = new AbortController()
  controller.abort()
  const progress = vi.fn()
  await expect(f.api.refreshRegistry({ ...f.input, force: true, signal: controller.signal, onProgress: progress })).rejects.toThrow('Cancelled')
  expect(progress).not.toHaveBeenCalled()
})

test('native registry parsing needs no browser URL constructor and matches backend identity/version rules', async () => {
  vi.stubGlobal('URL', undefined)
  try {
    const f = fixture({ [root]: { plugins: [manifestUrl('native')] }, [manifestUrl('native')]: manifest('native') })
    expect((await f.api.refreshRegistry(f.input)).plugins).toHaveLength(1)
    expect(registryIdentity('', 'https://github.com/Alice/Repo/releases/latest')).toBe('repo:alice/repo')
    expect(registryIdentity('', 'https://example.com/Alice/Repo')).toBe('')
    expect(compareRegistryVersions('2026.10.12', '2026.9.30')).toBeGreaterThan(0)
    expect(compareRegistryVersions('1.2', '1.2.0')).toBe(0)
  } finally { vi.unstubAllGlobals() }
})
