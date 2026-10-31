import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { environmentManager, QueryObserver } from '@tanstack/query-core'
import { createQueryClient } from '../lib/query/query-client.js'

const wasServer = environmentManager.isServer()
beforeEach(() => { vi.useFakeTimers(); environmentManager.setIsServer(() => true) })
afterEach(() => { environmentManager.setIsServer(() => wasServer); vi.useRealTimers() })

test('Worker-like environments release inactive queries but keep active player data', async () => {
  const client = createQueryClient()
  try {
    await client.fetchQuery({ queryKey: ['old-song'], queryFn: async () => ({ title: 'Previous' }) })
    const observer = new QueryObserver(client, { queryKey: ['current-song'], queryFn: async () => ({ title: 'Current' }), enabled: false })
    const stop = observer.subscribe(() => {})
    await observer.refetch()
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
    expect(client.getQueryData(['old-song'])).toBeUndefined()
    expect(client.getQueryData(['current-song'])).toEqual({ title: 'Current' })
    stop()
  } finally { client.clear() }
})

test('completed mutations also expire in a Worker rather than accumulating forever', async () => {
  const client = createQueryClient()
  try {
    const mutation = client.getMutationCache().build(client, { mutationFn: async () => 'done' })
    await mutation.execute(undefined)
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)
    expect(client.getMutationCache().getAll()).toHaveLength(0)
  } finally { client.clear() }
})
