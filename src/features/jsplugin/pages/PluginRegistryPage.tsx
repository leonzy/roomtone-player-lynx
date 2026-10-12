import { useEffect, useRef, useState } from '@lynx-js/react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Input } from '@lynx-js/lynx-ui-input'

import { performRouteBack } from '../../../core/navigation/route-back-action.js'
import { appConfig } from '../../../core/config/app-config.js'
import { useScrollMemory } from '../../../shared/nav/scroll-memory.js'
import { useBackHandler } from '../../../shared/nav/use-back-handler.js'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js'
import { Icon, ICON_COLORS } from '../../../shared/ui/Icon.js'
import { PopoverMenu } from '../../../shared/ui/PopoverMenu.js'
import type { PopoverMenuItem } from '../../../shared/ui/PopoverMenu.js'
import { toast } from '../../../shared/ui/toast-store.js'
import type { RegistryPluginEntry, RegistryRefreshResponse } from '../../../models/jsplugin.js'
import { clientRegistryApi, compareRegistryVersions } from '../api/client-registry-api.js'
import { getJSPluginApi } from '../api/index.js'
import type { PluginRegistryConfig } from '../api/index.js'
import { useGithubProxyQuery } from '../data/jsplugin-query.js'
import { useInstallFromRegistryMutation } from '../data/jsplugin-mutations.js'
import { saveRegistryReturnState, takeRegistryReturnState } from '../data/registry-return-state.js'
import { SubPageShell } from '../../settings/widgets/SubPageShell.js'
import { RegistryIcon } from '../widgets/RegistryIcon.js'
import { RegistryManageDialog } from '../widgets/RegistryManageDialog.js'
import './PluginRegistryPage.css'

/** Sentinel for the aggregated "all sources" picker entry. */
const ALL_SOURCES = '__all_sources__'
const GITHUB_DISCOVERY = '__github_discovery__'

export function PluginRegistryPage({ onBack, onOpenDiscovery }: { onBack?: () => void; onOpenDiscovery?: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const returnKey = `${appConfig.resolvedBaseUrl}${appConfig.basePath}`
  const [restored] = useState(() => takeRegistryReturnState(returnKey))
  const { initialOffset, onScroll } = useScrollMemory(`plugin-registry:${returnKey}`)
  const installMutation = useInstallFromRegistryMutation()
  const { data: githubProxy } = useGithubProxyQuery()

  const [registries, setRegistries] = useState<PluginRegistryConfig[]>(restored?.registries ?? [])
  const [loadingRegistries, setLoadingRegistries] = useState(!restored?.ready)
  /** The selected single source's URL; null = the aggregated "all" mode. */
  const [selectedUrl, setSelectedUrl] = useState<string | null>(restored?.selectedUrl ?? null)
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const [search, setSearch] = useState(restored?.search ?? '')
  const [page, setPage] = useState(restored?.page ?? 1)
  const [loading, setLoading] = useState(false)
  /** Append-fetch in flight (infinite scroll). Keeps the list visible while the
   * next page loads — distinct from `loading`, which replaces the whole list. */
  const [loadingMore, setLoadingMore] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plugins, setPlugins] = useState<RegistryPluginEntry[]>(restored?.plugins ?? [])
  const [total, setTotal] = useState(restored?.total ?? 0)
  const [warnings, setWarnings] = useState<string[]>(restored?.warnings ?? [])
  const [warningsOpen, setWarningsOpen] = useState(false)
  const pageSize = 20
  const generation = useRef(0)
  const active = useRef<AbortController | undefined>(undefined)
  const installedDuringListing = useRef(new Map<string, RegistryPluginEntry>())
  useEffect(() => () => { generation.current++; active.current?.abort() }, [returnKey])

  const sessionState = (entry: RegistryPluginEntry): RegistryPluginEntry => {
    const installed = installedDuringListing.current.get(entry.entryPath)
    if (!installed) return entry
    if ((entry.identity ?? '') === (installed.identity ?? '')) return { ...entry, installed: true,
      installedVersion: installed.version, hasUpdate: compareRegistryVersions(entry.version, installed.version) > 0, conflict: false, conflictWith: undefined }
    return { ...entry, installed: false, hasUpdate: false, conflict: true, conflictWith: `${installed.name} v${installed.version}` }
  }

  /** The row currently installing/reinstalling (rowKey); null = none. */
  const [installingKey, setInstallingKey] = useState<string | null>(null)
  /** The conflict entry awaiting the "replace" confirmation; null = closed. */
  const [confirmConflict, setConfirmConflict] = useState<RegistryPluginEntry | null>(null)

  const selected = selectedUrl != null
    ? registries.find((r) => r.url === selectedUrl)
    : undefined

  /**
   * The one listing fetch, with the source mode passed **explicitly** — the
   * state-flip race means a callback that just selected a source cannot read
   * `selectedUrl` yet.
   */
  const fetchList = (
    p: number,
    keyword: string,
    mode: { allSources: boolean, url?: string, token?: string },
    opts: { force?: boolean, append?: boolean, sources?: PluginRegistryConfig[] } = {},
  ) => {
    active.current?.abort()
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    active.current = controller
    const current = ++generation.current
    const currentServer = returnKey
    const valid = () => current === generation.current && !controller?.signal.aborted
      && currentServer === `${appConfig.resolvedBaseUrl}${appConfig.basePath}`
    if (opts.append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setError(null)
      installedDuringListing.current.clear()
      setCatalogLoading(true)
    }
    const apply = (res: RegistryRefreshResponse, complete = false) => {
      if (!valid()) return
      setPlugins(previous => [...new Map([
        ...(opts.append ? previous : []).map(entry => [rowKeyOf(entry), entry] as const),
        ...res.plugins.map(entry => [rowKeyOf(entry), sessionState(entry)] as const),
      ]).values()])
      setWarnings(res.warnings)
      setTotal(res.total)
      setPage(res.page)
      if (res.plugins.length || complete) setLoading(false)
      if (complete) { setLoadingMore(false); setCatalogLoading(false) }
    }
    void clientRegistryApi
      .refreshRegistry({
        allSources: mode.allSources,
        registryUrl: mode.url,
        // Each source keeps its own credential; the shared GitHub setting is a fallback.
        token: mode.token,
        page: p,
        pageSize,
        search: keyword || undefined,
        force: opts.force,
        githubProxy: githubProxy || undefined,
        registries: opts.sources ?? (registries.length ? registries : undefined),
        signal: controller?.signal,
        onProgress: partial => apply(partial),
        onSources: sources => {
          if (!valid()) return
          setRegistries(sources)
          if (mode.url && !sources.some(source => source.url === mode.url && source.enabled !== false)) setSelectedUrl(null)
        },
      })
      .then((res) => {
        // Append mode accumulates the next page onto the list (infinite scroll);
        // a fresh fetch (initial / search / source switch / force-refresh)
        // replaces it. Warnings describe the current listing and only refresh on
        // a replace — an append's partial-source failures would just flicker the
        // banner without adding actionable detail.
        apply(res, true)
      })
      .catch((e: unknown) => {
        if (!valid()) return
        // An append failure leaves the already-loaded rows intact: `page` did
        // not advance and `hasNext` still holds, so the next scroll-to-bottom
        // retries — mirroring the song list's react-query infinite scroll,
        // which surfaces `isError` without dropping the rows already shown.
        if (!opts.append) setError(String(e instanceof Error ? e.message : e))
      })
      .finally(() => {
        if (!valid()) return
        setLoading(false)
        setLoadingMore(false)
        setCatalogLoading(false)
      })
  }

  const currentMode = () => {
    const allSources = selectedUrl == null
    return {
      allSources,
      url: allSources ? undefined : (selectedUrl ?? undefined),
      token: allSources ? undefined : (selected?.token || undefined),
    }
  }

  const doFetch = (p: number, keyword: string, opts: { force?: boolean, append?: boolean } = {}) => {
    fetchList(p, keyword, currentMode(), opts)
  }

  const initialServer = useRef(returnKey)
  useEffect(() => {
    if (restored?.ready && initialServer.current === returnKey) return
    let alive = true
    setLoadingRegistries(true)
    setSelectedUrl(null)
    setRegistries([])
    setPlugins([])
    setWarnings([])
    setError(null)
    setTotal(0)
    setLoadingMore(false)
    setCatalogLoading(false)
    void getJSPluginApi().getPluginRegistries()
      .then((list) => {
        if (!alive || returnKey !== `${appConfig.resolvedBaseUrl}${appConfig.basePath}`) return
        setRegistries(list)
        setLoadingRegistries(false)
        if (list.some(source => source.enabled !== false)) {
          fetchList(1, search, { allSources: true }, { sources: list })
        }
      })
      .catch(() => { if (alive) setLoadingRegistries(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one boot per server; search has its own debounce
  }, [returnKey])
  const bootedRef = useRef(true)

  // Search debounces to a listing fetch (never forced: paging and searching
  // slice the client's cached tree). The mount run is skipped: the boot fetch
  // already owns the initial listing, and a mount-time timer would fire a
  // redundant refetch half a second later.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchMountedRef = useRef(false)
  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    generation.current++
    active.current?.abort()
    debounceRef.current = setTimeout(() => {
      if (bootedRef.current) doFetch(1, search)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyword only; re-running on source flip would double-fetch
  }, [search])

  const onForceRefresh = () => {
    // Refresh reloads from the first page (replace, not append) — the natural
    // "pull-to-refresh" semantic for an infinite list, which may have scrolled
    // several pages deep.
    if (!loading && !loadingMore && !catalogLoading) doFetch(1, search, { force: true })
  }

  const onSourceSelected = (url: string) => {
    'background only'
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    if (url === GITHUB_DISCOVERY) {
      saveRegistryReturnState(returnKey, { registries, selectedUrl, search, page, plugins, total, warnings, ready: !loading && !loadingMore && !catalogLoading && !loadingRegistries && !error })
      setSourceMenuOpen(false)
      if (onOpenDiscovery) onOpenDiscovery()
      else void navigate({ to: '/settings/plugins/registry/github' })
      return
    }
    const allSources = url === ALL_SOURCES
    const source = registries.find((r) => r.url === url)
    setSelectedUrl(allSources ? null : url)
    setPlugins([])
    setWarnings([])
    fetchList(1, search, {
      allSources,
      url: allSources ? undefined : url,
      token: allSources ? undefined : (source?.token || undefined),
    })
  }

  /**
   * Install success updates the rows **in place** (the whole listing is a
   * client-cached snapshot; refetching would flash and lose scroll position).
   * Matching is (entryPath, identity) — entry_path alone lights up another
   * author's same-named entry too (songloft-org/songloft#339), and those
   * neighbours flip to "conflict" because the local plugin they would clash
   * with is now the one just installed.
   */
  const markInstalled = (installed: RegistryPluginEntry) => {
    installedDuringListing.current.set(installed.entryPath, installed)
    setPlugins((list) => list.map((p) => {
      if (p.entryPath === installed.entryPath && (p.identity ?? '') === (installed.identity ?? '')) {
        return {
          ...p,
          installed: true,
          installedVersion: installed.version,
          hasUpdate: false,
          conflict: false,
          conflictWith: undefined,
        }
      }
      if (p.entryPath === installed.entryPath) {
        return {
          ...p,
          installed: false,
          conflict: true,
          conflictWith: installed.name
            + (installed.author ? `（${installed.author}）` : '')
            + ` v${installed.version}`,
        }
      }
      return p
    }))
  }

  const onInstall = (entry: RegistryPluginEntry, overwrite = false) => {
    // A conflicting entry replaces another author's plugin — that asks first.
    if (entry.conflict && !overwrite) {
      setConfirmConflict(entry)
      return
    }
    setConfirmConflict(null)
    setInstallingKey(rowKeyOf(entry))
    const sourceToken = registries.find(source => source.url === entry.sourceUrl)?.token || selected?.token || undefined
    installMutation.mutate(
      {
        downloadUrl: entry.downloadUrl,
        sourceUrl: entry.sourceUrl,
        overwrite,
        githubProxy: sourceToken ? undefined : githubProxy || undefined,
        // "All" mode cannot know which source the entry came from — its
        // sourceUrl lets the backend resolve that source's own token.
        token: entry.sourceUrl ? undefined : sourceToken,
      },
      {
        onSuccess: (result) => {
          if (result.success > 0) {
            toast.success(result.message || t('jsplugin.installDone'))
            markInstalled(entry)
          } else if (result.results[0]?.error) {
            toast.error(result.results[0].error)
          } else {
            toast.error(t('jsplugin.installFailed', { error: result.message }))
          }
        },
        onError: (e: unknown) => toast.error(t('jsplugin.installFailed', {
          error: e instanceof Error ? e.message : String(e),
        })),
        onSettled: () => setInstallingKey(null),
      },
    )
  }

  /**
   * Return to the plugin manager. In the wide settings master–detail this page
   * sits in the right pane and `onBack` swaps the pane back in place; as a
   * standalone route (single-column) fall back to routing. Mirrors
   * `PluginManagerPage.onStore`.
   */
  const goBack = () => {
    if (onBack) {
      onBack()
    } else {
      performRouteBack()
    }
  }

  const enabledRegistries = registries.filter((r) => r.enabled !== false)
  const sourceItems: PopoverMenuItem[] = [
    { key: ALL_SOURCES, label: t('jsplugin.allSources'), selected: selectedUrl == null },
    ...enabledRegistries.map((r) => ({
      key: r.url,
      label: r.name || r.url,
      selected: selectedUrl === r.url,
    })),
    { key: 'community', label: t('githubDiscovery.community'), kind: 'header' },
    { key: GITHUB_DISCOVERY, label: t('githubDiscovery.title'), icon: 'globe' },
  ]

  const hasNext = page * pageSize < total

  /**
   * Infinite-scroll load-more: fired by the scroller's `bindscrolltolower`
   * within 200px of the bottom. The `!loadingMore` guard stops the re-entrant
   * fires Lynx emits while the user holds the scroll position at the tail; the
   * `!loading` guard avoids racing a fresh replace fetch (force-refresh / source
   * switch) that is about to reset the list anyway.
   */
  const onEndReached = () => {
    if (hasNext && !loading && !loadingMore && !catalogLoading) doFetch(page + 1, search, { append: true })
  }

  // Back while nothing is armed follows the shell's normal route-back.
  useBackHandler(sourceMenuOpen, () => {
    setSourceMenuOpen(false)
    return true
  })

  return (
    <SubPageShell
      title={t('jsplugin.registryTitle')}
      onBack={goBack}
      backTestId='registry-back'
      // The search bar stays pinned above the results, so this page keeps its own
      // scroll container rather than letting the shell wrap everything.
      scrollable={false}
      // The shell's `.subpage__content` carries a `padding-bottom: var(--space-6)`
      // tail for shell-scrolled pages; here the page owns its scroll-view and
      // reserves the capsule tail itself via `.plugin-registry__nav-inset` inside
      // it, so the shell's extra padding would leave a dead strip below the
      // scroll-view (behind the bottom tab) that the list can never scroll into.
      contentClassName='plugin-registry__content'
      actions={(
        <view className='plugin-registry__topbar-actions'>
          <PopoverMenu
            show={sourceMenuOpen}
            onShowChange={setSourceMenuOpen}
            placement='bottom-end'
            triggerClassName='plugin-registry__topbar-btn'
            trigger={<Icon name='globe' size={18} color={ICON_COLORS.content} testId='registry-source-btn' />}
            items={sourceItems}
            onSelect={onSourceSelected}
          />
          <view
            className='plugin-registry__topbar-btn'
            bindtap={onForceRefresh}
            data-testid='registry-force-refresh'
          >
            <Icon name='refresh' size={18} color={ICON_COLORS.content} />
          </view>
          <view
            className='plugin-registry__topbar-btn'
            bindtap={() => setManageOpen(true)}
            data-testid='registry-manage-btn'
          >
            <Icon name='settings' size={18} color={ICON_COLORS.content} />
          </view>
        </view>
      )}
      overlay={(
        <>
          <ConfirmDialog
            show={confirmConflict != null}
            title={t('jsplugin.conflictDialogTitle')}
            message={t('jsplugin.conflictDialogBody', {
              entryPath: confirmConflict?.entryPath ?? '',
              plugin: confirmConflict?.conflictWith ?? '',
            })}
            confirmLabel={t('jsplugin.conflictDialogConfirm')}
            onConfirm={() => {
              const entry = confirmConflict
              setConfirmConflict(null)
              if (entry) onInstall(entry, true)
            }}
            onCancel={() => setConfirmConflict(null)}
            testId='registry-conflict-dialog'
            confirmTestId='registry-conflict-confirm'
            cancelTestId='registry-conflict-cancel'
          />
          <ConfirmDialog
            show={warningsOpen}
            title={t('jsplugin.registryWarningsTitle')}
            message={warnings.join('\n\n')}
            confirmLabel={t('common.close')}
            acknowledgeOnly
            onConfirm={() => setWarningsOpen(false)}
            onCancel={() => setWarningsOpen(false)}
            testId='registry-warnings-dialog'
            confirmTestId='registry-warnings-close'
          />
          <RegistryManageDialog
            show={manageOpen}
            onClose={() => setManageOpen(false)}
            registries={registries}
            onSaved={(saved) => {
              if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
              setRegistries(saved)
              // A deleted/disabled selection falls back to "all" (or nothing).
              if (selectedUrl != null && !saved.some((r) => r.url === selectedUrl && r.enabled !== false)) {
                setSelectedUrl(null)
                bootedRef.current = true
              }
              const remaining = selectedUrl == null ? undefined : saved.find(source => source.url === selectedUrl && source.enabled !== false)
              fetchList(1, search, { allSources: !remaining, url: remaining?.url, token: remaining?.token }, { force: true })
            }}
          />
        </>
      )}
    >
      {loadingRegistries
        ? <RegistryState text={t('common.loading')} testId='registry-loading-registries' />
        : registries.length === 0
          ? (
            <view className='plugin-registry__empty' data-testid='registry-no-sources'>
              <text className='plugin-registry__empty-title'>{t('jsplugin.noRegistries')}</text>
              <text className='plugin-registry__empty-hint'>{t('jsplugin.noRegistriesHint')}</text>
              <view
                className='plugin-registry__install-btn'
                bindtap={() => setManageOpen(true)}
                data-testid='registry-add-source'
              >
                <text className='plugin-registry__install-text'>{t('jsplugin.addRegistry')}</text>
              </view>
            </view>
          )
          : (
            <view className='plugin-registry__body'>
              <view className='plugin-registry__search'>
                <Input
                  className='plugin-registry__search-input'
                  value={search}
                  placeholder={t('jsplugin.searchPlaceholder')}
                  onInput={(value: string) => setSearch(value)}
                />
              </view>

              {warnings.length > 0
                ? (
                  <view
                    className='plugin-registry__warnings'
                    bindtap={() => setWarningsOpen(true)}
                    data-testid='registry-warnings'
                  >
                    <Icon name='warning' size={16} color={ICON_COLORS.danger} />
                    <text className='plugin-registry__warnings-text'>
                      {t('jsplugin.registryWarningsSummary', { count: warnings.length })}
                    </text>
                    <Icon name='info' size={16} color={ICON_COLORS.contentMuted} />
                  </view>
                )
                : null}

              <scroll-view
                className='plugin-registry__scroll'
                scroll-y
                initial-scroll-offset={initialOffset}
                bindscroll={onScroll}
                lower-threshold={200}
                bindscrolltolower={onEndReached}
                data-testid='registry-scroll'
              >
                {catalogLoading && !loading ? <view className='plugin-registry__footer' data-testid='registry-loading-background'><text className='plugin-registry__footer-text'>{t('jsplugin.loadingList')}</text></view> : null}
                {loading
                  ? <RegistryState text={t('jsplugin.loadingList')} testId='registry-loading' />
                  : error
                    ? (
                      <view className='plugin-registry__state'>
                        <text className='plugin-registry__state-text plugin-registry__state-text--error'>{error}</text>
                        <view
                          className='plugin-registry__retry-btn'
                          bindtap={onForceRefresh}
                          data-testid='registry-retry'
                        >
                          <text className='plugin-registry__retry-text'>{t('common.retry')}</text>
                        </view>
                      </view>
                    )
                    : plugins.length === 0
                      ? (
                        <RegistryState
                          text={search ? t('jsplugin.noMatch') : t('jsplugin.registryEmpty')}
                          testId='registry-empty'
                        />
                      )
                      : (
                        <view className='plugin-registry__list'>
                          {plugins.map((plugin) => (
                            <RegistryRow
                              key={rowKeyOf(plugin)}
                              entry={plugin}
                              installing={installingKey === rowKeyOf(plugin)}
                              onInstall={onInstall}
                            />
                          ))}
                        </view>
                      )}
                {loadingMore
                  ? (
                    <view className='plugin-registry__footer'>
                      <text className='plugin-registry__footer-text'>{t('common.loadingMore')}</text>
                    </view>
                  )
                  : null}
                <view className='plugin-registry__nav-inset' />
              </scroll-view>
            </view>
          )}
    </SubPageShell>
  )
}

/** Stable row identity: entry_path alone collides across authors (#339). */
function rowKeyOf(entry: RegistryPluginEntry): string {
  return `${entry.entryPath}|${entry.identity ?? ''}`
}

/**
 * One store row, mirroring the Flutter `_RegistryPluginItem`: icon, name,
 * author · source, a description line, a conflict warning line, and the four
 * action states (install / update-to / reinstall chip / overwrite).
 */
function RegistryRow({
  entry,
  installing,
  onInstall,
}: {
  entry: RegistryPluginEntry
  installing: boolean
  onInstall: (entry: RegistryPluginEntry, overwrite?: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <view className='plugin-registry__item'>
      <RegistryIcon entry={entry} />
      <view className='plugin-registry__item-info'>
        <text className='plugin-registry__item-name'>{entry.name}</text>
        {[entry.author, entry.sourceName].filter(Boolean).length > 0
          ? (
            <text className='plugin-registry__item-meta'>
              {[entry.author, entry.sourceName].filter(Boolean).join(' · ')}
            </text>
          )
          : null}
        {entry.description
          ? <text className='plugin-registry__item-desc'>{entry.description}</text>
          : null}
        {entry.conflict
          ? (
            <view className='plugin-registry__conflict-line'>
              <Icon name='warning' size={12} color={ICON_COLORS.danger} />
              <text className='plugin-registry__conflict-line-text'>
                {entry.conflictWith || t('jsplugin.conflictWarning')}
              </text>
            </view>
          )
          : null}
      </view>
      <view className='plugin-registry__item-action'>
        {installing
          ? (
            <view className='plugin-registry__installed' data-testid={`registry-installing-${entry.entryPath}`}>
              <text className='plugin-registry__installed-text'>{t('common.loading')}</text>
            </view>
          )
          : entry.installed && !entry.hasUpdate
            ? (
              /* The reinstall chip: the version it *would* land on, tapped to
                 land on it — Flutter's ActionChip(avatar: refresh, v{version}). */
              <view
                className='plugin-registry__reinstall'
                bindtap={() => onInstall(entry)}
                data-testid={`registry-reinstall-${entry.entryPath}`}
              >
                <Icon name='refresh' size={12} color={ICON_COLORS.contentMuted} />
                <text className='plugin-registry__reinstall-text'>
                  v{entry.installedVersion ?? entry.version}
                </text>
              </view>
            )
            : entry.installed && entry.hasUpdate
              ? (
                <view
                  className='plugin-registry__update-btn'
                  bindtap={() => onInstall(entry)}
                  data-testid={`registry-update-${entry.entryPath}`}
                >
                  <text className='plugin-registry__update-text'>
                    {t('jsplugin.updateTo', { version: entry.version })}
                  </text>
                </view>
              )
              : entry.conflict
                ? (
                  <view
                    className='plugin-registry__overwrite-btn'
                    bindtap={() => onInstall(entry)}
                    data-testid={`registry-install-${entry.entryPath}`}
                  >
                    <text className='plugin-registry__overwrite-text'>
                      {t('jsplugin.overwriteInstall')}
                    </text>
                  </view>
                )
                : (
                  <view
                    className='plugin-registry__install-btn'
                    bindtap={() => onInstall(entry)}
                    data-testid={`registry-install-${entry.entryPath}`}
                  >
                    <text className='plugin-registry__install-text'>{t('jsplugin.install')}</text>
                  </view>
                )}
      </view>
    </view>
  )
}

function RegistryState({ text, testId, tone }: { text: string; testId?: string; tone?: 'error' }) {
  return (
    <view className='plugin-registry__state' data-testid={testId}>
      <text
        className={tone === 'error'
          ? 'plugin-registry__state-text plugin-registry__state-text--error'
          : 'plugin-registry__state-text'}
      >
        {text}
      </text>
    </view>
  )
}
