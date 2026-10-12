import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from '@lynx-js/react'

import { appConfig } from '../../../core/config/app-config.js'
import { getSettingsApi } from '../../settings/api/index.js'
import { githubDiscoveryApi, GithubDiscoveryError, type GithubDiscoveryPageData } from '../api/github-discovery-api.js'

export function useGithubDiscoveryQuery(input: { search: string; sort: 'updated' | 'stars'; proxy: string; refresh: number; enabled: boolean; token: string; credentialRevision: number; serverKey: string }) {
  // Keys use a revision, never the credential itself.
  const key = JSON.stringify([input.serverKey, input.credentialRevision, input.search, input.sort, input.proxy, input.refresh])
  const [progress, setProgress] = useState<{ key: string; page: number; data: GithubDiscoveryPageData } | null>(null)
  const query = useInfiniteQuery({
    queryKey: ['github-discovery', input.serverKey, input.credentialRevision, input.search, input.sort, input.proxy, input.refresh],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => githubDiscoveryApi.discover({ ...input, page: pageParam, force: input.refresh > 0, signal,
      onProgress: data => setProgress({ key, page: pageParam, data }) }),
    enabled: input.enabled,
    getNextPageParam: page => page.nextPage,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return { ...query, progress: query.isFetching && progress?.key === key ? progress : null }
}

export function useDiscoveryHostVersion() {
  return useQuery({
    queryKey: ['github-discovery-host', appConfig.resolvedBaseUrl, appConfig.basePath],
    queryFn: () => getSettingsApi().getVersion(),
    staleTime: 60_000,
    retry: false,
  })
}

export function discoveryErrorKey(error: unknown): string {
  if (error instanceof GithubDiscoveryError && error.reason === 'invalidToken') return 'githubDiscovery.tokenInvalid'
  return error instanceof GithubDiscoveryError && error.reason === 'rateLimited'
    ? 'githubDiscovery.rateLimited' : 'githubDiscovery.loadFailed'
}
