import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from '@lynx-js/react'

import { appConfig } from '../../../core/config/app-config.js'
import { getSettingsApi } from '../../settings/api/index.js'

export function useGithubDiscoveryTokenQuery() {
  const client = useQueryClient()
  const serverBaseUrl = `${appConfig.resolvedBaseUrl}${appConfig.basePath}`
  const key = ['github-discovery-token', serverBaseUrl]
  const assertCurrent = () => {
    if (`${appConfig.resolvedBaseUrl}${appConfig.basePath}` !== serverBaseUrl) throw new Error('Server changed')
  }
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const value = await getSettingsApi().getGithubDiscoveryToken({ serverBaseUrl, assertCurrent })
      assertCurrent()
      return value
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const save = useMutation({
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    mutationFn: async (token: string) => {
      const saved = await getSettingsApi().updateGithubDiscoveryToken(token, { serverBaseUrl, assertCurrent })
      assertCurrent()
      return saved
    },
    onSuccess: saved => client.setQueryData(key, saved),
  })
  const credential = useRef<{ value?: string; revision: number }>({ revision: 0 })
  if (credential.current.value !== query.data) {
    credential.current.value = query.data
    credential.current.revision++
  }
  return { ...query, save, serverBaseUrl, credentialRevision: credential.current.revision }
}
