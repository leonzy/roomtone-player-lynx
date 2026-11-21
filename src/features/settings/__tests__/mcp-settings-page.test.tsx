import '../../../shims/router-env.js'
import '@testing-library/jest-dom'
import { expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'

const mocks = vi.hoisted(() => ({
  settings: {
    enabled: false,
    token: 'rtmcp_test',
    scopes: ['read'],
    managedByEnvironment: false,
    endpoint: '/mcp',
  },
  copy: vi.fn(async () => {}),
}))

vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)
vi.mock('../api/index.js', () => ({
  getSettingsApi: () => ({
    getMCPSettings: async () => mocks.settings,
    updateMCPSettings: async (update: { enabled?: boolean }) => {
      mocks.settings = { ...mocks.settings, ...update }
      return mocks.settings
    },
  }),
}))
vi.mock('../../../native/native-platform.js', () => ({ copyToClipboard: mocks.copy }))

const { MCPSettingsPage } = await import('../pages/MCPSettingsPage.js')

test('MCP settings page renders agent endpoint and copyable configuration', async () => {
  render(<MCPSettingsPage />)
  await act(async () => { await Promise.resolve() })
  const queries = getQueriesForElement(elementTree.root!)
  expect(elementTree.root!.textContent).toContain('/mcp')
  expect(elementTree.root!.textContent).toContain('"Authorization": "Bearer rtmcp_test"')
  const copy = queries.queryByTestId('mcp-copy-config')
  expect(copy).toBeTruthy()
  await act(async () => { fireEvent.tap(copy!) })
  expect(mocks.copy).toHaveBeenCalledOnce()
})
