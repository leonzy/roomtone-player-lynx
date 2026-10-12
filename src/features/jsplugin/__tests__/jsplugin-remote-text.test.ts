import { expect, test, vi } from 'vitest'
import { appConfig } from '../../../core/config/app-config.js'
import { HttpClient, type Transport } from '../../../core/network/http-client.js'
import { JSPluginApi } from '../api/jsplugin-api.js'

test('external registry SVG icons do not receive Songloft authentication', async () => {
  const before = appConfig.baseUrl
  appConfig.baseUrl = 'https://songloft.test'
  try {
    const transport = vi.fn<Transport>(async () => ({ status: 200, headers: {}, body: '<svg/>' }))
    const api = new JSPluginApi(new HttpClient({ getBaseUrl: () => appConfig.resolvedBaseUrl, transport,
      interceptor: { onRequest: request => { request.headers.Authorization = 'Bearer songloft-jwt' } } }))
    await api.getRemoteText('https://raw.githubusercontent.com/alice/store/main/icon.svg')
    expect(transport.mock.calls[0]?.[0].headers.Authorization).toBeUndefined()
    await api.getRemoteText('https://songloft.test/api/v1/icon.svg')
    expect(transport.mock.calls[1]?.[0].headers.Authorization).toBe('Bearer songloft-jwt')
  } finally { appConfig.baseUrl = before }
})
