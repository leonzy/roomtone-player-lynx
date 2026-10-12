import { createFetchTransport, type Transport } from '../../../core/network/http-client.js'
import { isWebPlatform } from '../../../native/web-platform.js'
import type { JSPlugin, RegistryPluginEntry, RegistryRefreshResponse } from '../../../models/jsplugin.js'
import { withGithubProxy } from '../../../core/updater/release-resolver.js'
import { utf8Size } from '../domain/github-plugin-validation.js'
import type { JSPluginApi, PluginRegistryConfig, RegistryRefreshParams } from './jsplugin-api.js'
import { getJSPluginApi } from './index.js'
import { getSettingsApi } from '../../settings/api/index.js'
import { appConfig } from '../../../core/config/app-config.js'

interface Catalog { plugins: RegistryPluginEntry[]; warnings: string[] }
export interface ClientRegistryParams extends RegistryRefreshParams {
  registries?: PluginRegistryConfig[]
  signal?: AbortSignal
  onProgress?: (response: RegistryRefreshResponse) => void
  githubToken?: string
  onSources?: (sources: PluginRegistryConfig[]) => void
}

class RegistryConnectionError extends Error {}
class RegistryReadError extends Error {}

/** URI parsing without the browser URL constructor, which is absent on native Lynx. */
function httpAddress(address: string): { origin: string; host: string; path: string } {
  const match = address.match(/^(https?):\/\/([^/?#\s]+)([^?#]*)(?:\?[^#]*)?(?:#.*)?$/i)
  if (!match || match[2]!.includes('@') || address.includes('\\')) throw new RegistryReadError('Invalid registry URL')
  return { origin: `${match[1]!.toLowerCase()}://${match[2]!.toLowerCase()}`, host: match[2]!.toLowerCase(), path: match[3] || '/' }
}

function sameOrigin(a: string, b: string): boolean {
  try { return httpAddress(a).origin === httpAddress(b).origin } catch { return false }
}

function githubProxyAddress(address: string, proxy: string): string {
  const host = httpAddress(address).host.replace(/:\d+$/, '')
  return ['github.com', 'raw.githubusercontent.com', 'api.github.com', 'objects.githubusercontent.com'].includes(host)
    || host.endsWith('.github.io') ? withGithubProxy(address, proxy) : address
}

export function registryIdentity(author = '', updateUrl = ''): string {
  const normalized = author.replace(/<[^>]*>|\([^)]*\)/g, ' ').replace(/[ \t\n\r\f]+/g, ' ').trim().toLowerCase()
  if (normalized) return normalized
  try {
    const url = httpAddress(updateUrl)
    if (!['github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.host)) return ''
    const parts = url.path.replace(/^\/+|\/+$/g, '').split('/')
    return parts[0] && parts[1] ? `repo:${parts[0].toLowerCase()}/${parts[1].toLowerCase()}` : ''
  } catch { return '' }
}

export function compareRegistryVersions(a: string, b: string): number {
  const first = a.split('.'), second = b.split('.')
  const number = (value = '') => /^[-+]?\d+$/.test(value) ? Number(value) : 0
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    const delta = number(first[i]) - number(second[i])
    if (delta) return delta
  }
  return 0
}

function installedState(entry: RegistryPluginEntry, installed: JSPlugin[]): RegistryPluginEntry {
  const local = installed.find(plugin => plugin.entryPath === entry.entryPath)
  if (!local) return { ...entry, installed: false, hasUpdate: false, conflict: false, installedVersion: undefined, conflictWith: undefined }
  const identity = registryIdentity(local.author, local.updateUrl)
  if (entry.identity && identity && entry.identity !== identity) return { ...entry, installed: false, hasUpdate: false,
    installedVersion: undefined, conflict: true, conflictWith: `${local.displayName}${local.author ? ` (${local.author})` : ''} v${local.version ?? ''}` }
  return { ...entry, installed: true, installedVersion: local.version, hasUpdate: compareRegistryVersions(entry.version, local.version ?? '') > 0,
    conflict: false, conflictWith: undefined }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RegistryReadError('Invalid registry JSON')
  return value as Record<string, unknown>
}

export class ClientRegistryApi {
  private signature = ''
  private revision = 0
  private cache: { until: number; catalog: Catalog } | undefined
  private active = 0
  private readonly waiters: Array<() => void> = []
  private readonly backend: () => JSPluginApi
  private readonly transport: Transport
  private readonly web: boolean
  private readonly now: () => number
  private readonly githubToken: () => Promise<string>
  private readonly serverBaseUrl?: () => string
  constructor(options: { backend?: () => JSPluginApi; transport?: Transport; web?: boolean; now?: () => number; githubToken?: () => Promise<string>; serverBaseUrl?: () => string } = {}) {
    this.backend = options.backend ?? getJSPluginApi
    this.transport = options.transport ?? createFetchTransport()
    this.web = options.web ?? isWebPlatform()
    this.now = options.now ?? Date.now
    this.githubToken = options.githubToken ?? (async () => '')
    this.serverBaseUrl = options.serverBaseUrl
  }

  private ensureActive(signal?: AbortSignal): void {
    if (signal?.aborted) throw new RegistryReadError('Cancelled')
  }

  private async read({ address, proxy, token, githubToken, signal }: {
    address: string; proxy: string; token: string; githubToken: string; signal?: AbortSignal
  }): Promise<Record<string, unknown>> {
    this.ensureActive(signal)
    httpAddress(address)
    // Source credentials take precedence. The shared token is only for the official GitHub API.
    const credential = token || (httpAddress(address).origin === 'https://api.github.com' ? githubToken : '')
    if (this.active >= 8) await new Promise<void>(resolve => this.waiters.push(resolve))
    else this.active++
    try {
      this.ensureActive(signal)
      const send = async (url: string) => {
        let response
        try { response = await this.transport({ url, method: 'GET', headers: { Accept: 'application/json',
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, timeoutMs: 15_000,
          ...(credential ? { redirect: 'error' as const } : {}) }) }
        catch { throw new RegistryConnectionError('Could not connect to registry') }
        this.ensureActive(signal)
        if (response.status < 200 || response.status >= 300) throw new RegistryReadError(`HTTP ${response.status}`)
        if (utf8Size(response.body) > 2 * 1024 * 1024) throw new RegistryReadError('Registry JSON exceeds 2 MiB')
        try { return object(JSON.parse(response.body)) } catch { throw new RegistryReadError('Invalid registry JSON') }
      }
      // Private source credentials are used only on direct requests, never prefix proxies.
      const proxied = credential ? address : githubProxyAddress(address, proxy)
      try { return await send(proxied) }
      catch (error) {
        this.ensureActive(signal)
        if (proxied === address) throw error
        return send(address)
      }
    } finally {
      const next = this.waiters.shift()
      if (next) next()
      else this.active--
    }
  }

  async refreshRegistry(input: ClientRegistryParams = {}): Promise<RegistryRefreshResponse> {
    const serverBaseUrl = this.serverBaseUrl?.()
    const assertCurrent = () => {
      this.ensureActive(input.signal)
      if (serverBaseUrl !== undefined && this.serverBaseUrl?.() !== serverBaseUrl) throw new RegistryReadError('Server changed')
    }
    assertCurrent()
    const configured = input.force ? await this.backend().getPluginRegistries()
      : input.registries ?? (input.allSources ? await this.backend().getPluginRegistries() : [])
    assertCurrent()
    if (input.force) input.onSources?.(configured)
    const requested = configured.find(source => source.url === input.registryUrl)
    const selectionRemoved = input.force && !input.allSources
      && input.registries?.some(source => source.url === input.registryUrl)
      && (!requested || requested.enabled === false)
    const sources = input.allSources || selectionRemoved ? configured.filter(source => source.enabled !== false)
      : [requested ?? { url: input.registryUrl ?? '', token: input.token }]
    const proxy = input.githubProxy ?? ''
    let githubToken = '', tokenWarning = ''
    try { githubToken = input.githubToken ?? await this.githubToken() }
    catch { tokenWarning = 'Could not read GitHub token setting.' }
    assertCurrent()
    // This private signature is not used as a query key or exposed to logging.
    const signature = JSON.stringify([serverBaseUrl, proxy, sources, githubToken])
    if (this.signature !== signature || input.force) { this.signature = signature; this.revision++; this.cache = undefined }
    const revision = this.revision
    const installed = (await this.backend().getPlugins()).plugins
    assertCurrent()
    const page = Math.max(1, input.page ?? 1), pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20))
    const snapshot = (catalog: Catalog): RegistryRefreshResponse => {
      const search = input.search?.trim().toLowerCase() ?? ''
      const entries = catalog.plugins.filter(entry => !search || [entry.name, entry.entryPath, entry.author, entry.description]
        .some(value => value?.toLowerCase().includes(search)))
      return { plugins: entries.slice((page - 1) * pageSize, page * pageSize).map(entry => installedState(entry, installed)),
        total: entries.length, page, pageSize, warnings: [...catalog.warnings] }
    }
    if (!input.force && this.cache && this.cache.until > this.now()) return snapshot(this.cache.catalog)
    const catalog: Catalog = { plugins: [], warnings: [] }
    if (tokenWarning) catalog.warnings.push(tokenWarning)
    const merged = new Map<string, number>()
    const progress = () => { this.ensureActive(input.signal); input.onProgress?.(snapshot(catalog)) }
    const add = (entry: RegistryPluginEntry) => {
      this.ensureActive(input.signal)
      const key = `${entry.entryPath}|${entry.identity ?? ''}`, index = merged.get(key)
      if (index !== undefined) {
        if (compareRegistryVersions(entry.version, catalog.plugins[index]!.version) > 0) catalog.plugins[index] = entry
      } else { merged.set(key, catalog.plugins.length); catalog.plugins.push(entry) }
      progress()
    }
    const warn = (address: string, error: unknown) => {
      this.ensureActive(input.signal)
      catalog.warnings.push(`${address}: ${error instanceof Error ? error.message : 'Could not read registry'}`)
      progress()
    }
    const fallback = async (source: PluginRegistryConfig) => {
      let next = 1
      while (next <= 5) {
        this.ensureActive(input.signal)
        const response = await this.backend().refreshRegistry({ registryUrl: source.url, token: source.token,
          githubProxy: source.token ? undefined : proxy || undefined, page: next, pageSize: 100, force: next === 1 && input.force,
          serverBaseUrl, assertCurrent })
        this.ensureActive(input.signal)
        for (const entry of response.plugins) add({ ...entry, sourceUrl: source.url, sourceName: source.name })
        if (next === 1) catalog.warnings.push(...response.warnings)
        if (next * 100 >= response.total || !response.plugins.length) break
        next++
      }
    }
    await Promise.all(sources.map(async source => {
      const seen = new Set<string>(), urls = new Set<string>()
      let connectionFailed = false
      const resolve = async (address: string, token: string) => {
        try {
          const data = await this.read({ address, proxy, token, githubToken, signal: input.signal })
          const string = (key: string) => typeof data[key] === 'string' ? data[key] as string : ''
          let download = string('download_url'), update = string('updateUrl')
          const visited = new Set([address])
          for (let depth = 0; !download && update && depth < 2; depth++) {
            if (visited.has(update)) throw new RegistryReadError('Update metadata cycle')
            visited.add(update)
            const credential = token && (sameOrigin(update, address) || sameOrigin(update, source.url)) ? token : ''
            const metadata = await this.read({ address: update, proxy, token: credential, githubToken, signal: input.signal })
            download = typeof metadata.download_url === 'string' ? metadata.download_url : ''
            update = typeof metadata.updateUrl === 'string' ? metadata.updateUrl : ''
          }
          const entryPath = string('entryPath')
          if (!entryPath || !download) throw new RegistryReadError('Plugin has no entryPath or download_url')
          httpAddress(download)
          let icon = string('icon')
          if (icon) {
            const base = address.replace(/[?#].*$/, '').replace(/[^/]*$/, '')
            icon = /^(https?):\/\//i.test(icon) ? icon : `${base}${icon.includes('/') ? icon : `static/${icon}`}`
            httpAddress(icon)
            icon = githubProxyAddress(icon, proxy)
          }
          add({ name: string('name'), entryPath, version: string('version'), description: string('description'), author: string('author'),
            homepage: string('homepage'), icon: icon || undefined, downloadUrl: download, sourceUrl: source.url, sourceName: source.name,
            identity: registryIdentity(string('author'), string('updateUrl')), installed: false, hasUpdate: false, conflict: false,
            installedVersion: undefined, conflictWith: undefined })
        } catch (error) {
          if (error instanceof RegistryConnectionError) connectionFailed = true
          warn(address, error)
        }
      }
      const visit = async (address: string, token: string, depth: number): Promise<void> => {
        this.ensureActive(input.signal)
        const key = address.replace(/\/$/, '')
        if (seen.has(key)) return
        if (depth > 20 || seen.size >= 512) { warn(address, new RegistryReadError('Registry include limit reached')); return }
        seen.add(key)
        const registry = await this.read({ address, proxy, token, githubToken, signal: input.signal })
        if (!Array.isArray(registry.plugins) || registry.plugins.some(url => typeof url !== 'string')
          || registry.includes != null && (!Array.isArray(registry.includes) || registry.includes.some(url => typeof url !== 'string'))) throw new RegistryReadError('Invalid registry URL list')
        const work: Promise<void>[] = []
        for (const url of registry.plugins as string[]) {
          if (urls.has(url)) continue
          if (urls.size >= 500) { warn(source.url, new RegistryReadError('Plugin limit reached (500)')); break }
          urls.add(url)
          // Explicit plugin URLs inherit this registry's credential; cross-origin includes already clear it.
          work.push(resolve(url, token))
        }
        for (const url of (registry.includes ?? []) as string[]) {
          if (seen.size >= 512) { warn(source.url, new RegistryReadError('Registry include limit reached')); break }
          const credential = token && sameOrigin(url, address) ? token : ''
          work.push(visit(url, credential, depth + 1).catch(error => { if (error instanceof RegistryConnectionError) connectionFailed = true; warn(url, error) }))
        }
        await Promise.all(work)
      }
      try { await visit(source.url, source.token ?? '', 0) }
      catch (error) { if (error instanceof RegistryConnectionError) connectionFailed = true; warn(source.url, error) }
      // Browser CORS/network failures retain the existing authenticated backend reader as a fallback.
      if (this.web && connectionFailed) {
        try { await fallback(source) } catch (error) { warn(source.url, error) }
      }
    }))
    assertCurrent()
    if (revision === this.revision && (catalog.plugins.length || !catalog.warnings.length)) this.cache = { catalog, until: this.now() + 5 * 60_000 }
    return snapshot(catalog)
  }
}

export const clientRegistryApi = new ClientRegistryApi({ githubToken: () => getSettingsApi().getGithubDiscoveryToken(),
  serverBaseUrl: () => `${appConfig.resolvedBaseUrl}${appConfig.basePath}` })
