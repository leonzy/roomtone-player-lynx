import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { afterEach, expect, test, vi } from 'vitest'
import { DLNACalibration, parseDLNADelay } from '../DLNACalibration.js'
import { outputApi, type OutputDevice } from '../api.js'

const actions = vi.hoisted(() => ({ error: '' }))
vi.mock('../runtime.js', () => ({ useZoneState: (selector: (s: { busy: boolean }) => unknown) => selector({ busy: false }), outputAction: async (action: () => Promise<unknown>) => { actions.error = ''; try { await action() } catch (e) { actions.error = String(e) } }, openOutputPanel: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'zh' } }) }))
vi.mock('@lynx-js/lynx-ui-input', async () => (await import('../../../__tests__/_render-mocks.js')).mockLynxUiInput())
vi.mock('@lynx-js/lynx-ui-slider', async () => (await import('../../../__tests__/_render-mocks.js')).mockLynxUiSlider())
afterEach(() => vi.restoreAllMocks())
const device = { ID: 'dlna:test', Name: '小爱', Kind: 'dlna', dlna_sync_delay_ms: 1000 } as OutputDevice

test('DLNA delay validates bounded integers only', () => {
  for (const v of ['', '-10', '1.5', '2001', 'NaN']) expect(parseDLNADelay(v)).toBeNull()
  for (const v of ['0', '1000', '2000']) expect(parseDLNADelay(v)).toBe(Number(v))
})
test('device calibration reads saved value, keeps draft local and saves only this setting', async () => {
  const update = vi.spyOn(outputApi, 'updateDevice').mockResolvedValue({})
  vi.spyOn(outputApi, 'outputs').mockResolvedValue({ players: [device], groups: [] })
  render(<DLNACalibration device={device} />)
  const query = getQueriesForElement(elementTree.root!)
  expect(query.getByText('小爱')).toBeTruthy()
  expect(query.getByText('DLNA')).toBeTruthy()
  await act(async () => { fireEvent.tap(query.getByTestId('calibration-step-10')) })
  expect(update).not.toHaveBeenCalled()
  await act(async () => { fireEvent.tap(query.getByText('保存')); await Promise.resolve() })
  expect(update.mock.calls).toEqual([['dlna:test', { dlna_sync_delay_ms: 1010 }]])
  expect(query.getByText('已保存')).toBeTruthy()
})

test('conflicting device changes and failed saves cannot claim success', async () => {
  const update = vi.spyOn(outputApi, 'updateDevice').mockRejectedValue(new Error('disk full'))
  const read = vi.spyOn(outputApi, 'outputs').mockResolvedValue({ players: [{ ...device, dlna_sync_delay_ms: 500 }], groups: [] })
  render(<DLNACalibration device={device} />)
  const query = getQueriesForElement(elementTree.root!)
  await act(async () => { fireEvent.tap(query.getByTestId('calibration-step-10')) })
  await act(async () => { fireEvent.tap(query.getByText('保存')); await Promise.resolve() })
  expect(update).not.toHaveBeenCalled()
  expect(actions.error).toContain('其它客户端')
  expect(query.queryByText('已保存')).toBeNull()
  read.mockResolvedValue({ players: [device], groups: [] })
  await act(async () => { fireEvent.tap(query.getByText('保存')); await Promise.resolve() })
  expect(actions.error).toContain('disk full')
  expect(query.queryByText('已保存')).toBeNull()
})
