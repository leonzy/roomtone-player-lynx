import { act, fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library'
import { expect, test, vi } from 'vitest'
import { GroupEditor } from '../OutputPanels.js'
import type { OutputDevice, OutputGroup } from '../api.js'
vi.mock('../../player/store/player-store.js', () => ({ usePlayerStore: (selector: (s: unknown) => unknown) => selector({ currentSong: null }), useLocalPlayerStore: {} }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'zh' } }) }))
vi.mock('@lynx-js/lynx-ui-input', async () => (await import('../../../__tests__/_render-mocks.js')).mockLynxUiInput())
vi.mock('@lynx-js/lynx-ui-slider', async () => (await import('../../../__tests__/_render-mocks.js')).mockLynxUiSlider())
vi.mock('../runtime.js', () => ({ useZoneState: (s: (v: unknown) => unknown) => s({ busy: false, error: '' }), outputAction: async (f: () => Promise<unknown>) => f(), openOutputPanel: vi.fn(), createZonePlayer: (engine: unknown) => engine, outputKey: () => ['channels'], readOutputs: () => ({ players: [], groups: [] }) }))
test('all members including DLNA master and Web show independent channel choices', async () => {
 const players = ['dlna', 'raop', 'local'].map((Kind, i) => ({ ID: String(i), Name: Kind, Kind, Online: true, Caps: { sync_tier: 'coarse' } })) as OutputDevice[]
 const group = { id: 'g', name: 'Group', master_id: '0', members: players.map(p => ({ player_id: p.ID, channel_mode: 'stereo' })), status: { song_id: 0, state: 'idle' } } as OutputGroup
 render(<GroupEditor group={group} players={players} groups={[group]} />)
 const query = getQueriesForElement(elementTree.root!)
 await act(async () => { fireEvent.tap(query.getByTestId('output-group-channels-toggle')) })
 for (const player of players) {
   const member = getQueriesForElement(query.getByTestId(`output-group-channel-${player.ID}`))
   expect(member.getByText('左声道')).toBeTruthy()
   expect(member.getByText('右声道')).toBeTruthy()
 }
})
