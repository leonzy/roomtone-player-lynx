import '../../../shims/router-env.js'
import '@testing-library/jest-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'

const { navigateSpy, getVersionSpy, openURLSpy } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  getVersionSpy: vi.fn(async () => '2.9.1'),
  openURLSpy: vi.fn(),
}))

vi.mock('react-i18next', async () =>
  (await import('../../../__tests__/_render-mocks.js')).mockReactI18next(),
)
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateSpy }))
vi.mock('../../../native/native-platform.js', () => ({ openURL: openURLSpy }))

/**
 * Per-endpoint stubs so a test can make `/upgrade/progress` fail while
 * `/upgrade/check` still answers. Lifted from the former upgrade-page test, now
 * driven through the `UpgradeSection` rendered inside `AboutPage`.
 */
const checkResponse = {
  has_update: false,
  current_version: '2.1.0',
  latest_version: '2.1.0',
  changelog: undefined as string | undefined,
}
let progressGet: () => Promise<{ data: Record<string, unknown> }>

const get = vi.fn(async (url: string) => {
  if (url.endsWith('/upgrade/progress')) return progressGet()
  return { data: { ...checkResponse } }
})

vi.mock('../api/index.js', () => ({
  getSettingsApi: () => ({
    getVersion: getVersionSpy,
    client: { get, post: vi.fn(async () => ({ data: {} })) },
  }),
}))

const { AboutPage } = await import('../pages/AboutPage.js')
const { clientVersion } = await import('../../../core/config/constants.js')

afterEach(() => {
  vi.clearAllMocks()
  checkResponse.has_update = false
  checkResponse.changelog = undefined
  vi.useRealTimers()
})

async function renderPage(props: { onOpenLicenses?: () => void } = {}) {
  render(<AboutPage {...props} />)
  // Let the version read and the upgrade check promises resolve.
  await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  return getQueriesForElement(elementTree.root!)
}

// ── About rows ───────────────────────────────────────────────────────────────

test('shows the client version and the backend version once it resolves', async () => {
  const { queryByTestId, queryByText } = await renderPage()

  expect(queryByTestId('settings-version')).toBeInTheDocument()
  expect(queryByText(clientVersion)).toBeInTheDocument()
  expect(queryByText('2.9.1')).toBeInTheDocument()
})

test('the licenses row routes when rendered as its own page', async () => {
  const { queryByTestId } = await renderPage()

  await act(async () => { fireEvent.tap(queryByTestId('settings-licenses')!) })

  expect(navigateSpy).toHaveBeenCalledWith({ to: '/settings/licenses' })
})

test('the licenses row defers to onOpenLicenses inside the settings pane', async () => {
  // In the pane, routing to `/settings/licenses` would unmount the whole
  // master–detail page and drop the settings list — so the drill-in has to stay a
  // swap within the pane (53fb045).
  const onOpenLicenses = vi.fn()
  const { queryByTestId } = await renderPage({ onOpenLicenses })

  await act(async () => { fireEvent.tap(queryByTestId('settings-licenses')!) })

  expect(onOpenLicenses).toHaveBeenCalledTimes(1)
  expect(navigateSpy).not.toHaveBeenCalled()
})

// ── Backend update (merged in from the former /settings/upgrade page) ─────────

test('renders backend release Markdown inside About and keeps links and the upgrade action usable', async () => {
  checkResponse.has_update = true
  checkResponse.changelog =
    '## 更新内容\n\n- **修复**说明显示\n\n[详情](https://example.com/release)\n\n| 平台 | 状态 |\n| --- | --- |\n| Android | 已修复 |'
  const queries = await renderPage()
  expect(
    queries.getByText('更新内容').closest('.markdown__heading--2'),
  ).toBeInTheDocument()
  expect(
    queries.getByText('修复').closest('.markdown__strong'),
  ).toBeInTheDocument()
  const notes = elementTree.root!.querySelector('.upgrade-page__changelog')!
  expect(notes.querySelector('.markdown__table-scroll')).toHaveAttribute(
    'scroll-orientation',
    'horizontal',
  )
  expect(notes.textContent).not.toContain('| --- |')
  expect(queries.getByTestId('upgrade-start')).toBeInTheDocument()
  await act(async () => {
    fireEvent.tap(queries.getByText('详情'))
  })
  expect(openURLSpy).toHaveBeenCalledExactlyOnceWith(
    'https://example.com/release',
  )
})

test('shows up-to-date when no update available', async () => {
  const { queryByText } = await renderPage()

  expect(queryByText('Up to date')).toBeInTheDocument()
  expect(queryByText('2.1.0')).toBeInTheDocument()
})

/**
 * `replacing`/`restarting` means the server being polled is going away, so
 * progress requests are *expected* to fail for a while — but a backend that
 * never comes back used to leave this page polling forever, raising an unhandled
 * rejection every 2s while the UI sat on the last percentage with no conclusion.
 * Tolerate a restart-sized outage, then stop with an actionable message.
 */
test('a progress endpoint that never recovers eventually gives up', async () => {
  checkResponse.has_update = true
  progressGet = () => Promise.reject(new Error('ECONNREFUSED'))

  // Fake timers must be installed BEFORE the polling setInterval is created,
  // otherwise advanceTimersByTime cannot reach it.
  vi.useFakeTimers()
  render(<AboutPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })

  const { queryByText, queryByTestId } = getQueriesForElement(elementTree.root!)
  // Start the upgrade so the polling effect mounts.
  await act(async () => {
    fireEvent.tap(queryByTestId('upgrade-start')!)
  })

  // 14 failed ticks: still trying, no verdict yet.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(14 * 2000)
  })
  expect(queryByText(/Lost contact with the server/)).not.toBeInTheDocument()

  // The 15th failure crosses the threshold.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(queryByText(/Lost contact with the server/)).toBeInTheDocument()

  // Polling really stopped — no further requests after giving up.
  const callsAtGiveUp = get.mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10 * 2000)
  })
  expect(get.mock.calls.length).toBe(callsAtGiveUp)
})

test('a transient progress failure does not abort the upgrade', async () => {
  checkResponse.has_update = true
  let calls = 0
  progressGet = () => {
    calls += 1
    // Fail twice (a restart), then report completion.
    if (calls <= 2) return Promise.reject(new Error('ECONNREFUSED'))
    return Promise.resolve({ data: { status: 'completed', progress: 100 } })
  }

  vi.useFakeTimers()
  render(<AboutPage />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10)
  })
  const { queryByText, queryByTestId } = getQueriesForElement(elementTree.root!)
  await act(async () => {
    fireEvent.tap(queryByTestId('upgrade-start')!)
  })

  await act(async () => {
    await vi.advanceTimersByTimeAsync(3 * 2000)
  })

  expect(queryByText('Update complete')).toBeInTheDocument()
  expect(queryByText(/Lost contact with the server/)).not.toBeInTheDocument()
})
