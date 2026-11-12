import {act,fireEvent,getQueriesForElement,render} from '@lynx-js/react/testing-library'
import {afterEach,expect,test,vi} from 'vitest'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {Sleep} from '../OutputPanels.js'
import {outputApi,type OutputGroup} from '../api.js'
vi.mock('react-i18next',()=>({useTranslation:()=>({i18n:{language:'zh'}})}))
vi.mock('@lynx-js/lynx-ui-input',async()=> (await import('../../../__tests__/_render-mocks.js')).mockLynxUiInput())
vi.mock('@lynx-js/lynx-ui-slider',async()=> (await import('../../../__tests__/_render-mocks.js')).mockLynxUiSlider())
vi.mock('../runtime.js',()=>({useZoneState:(s:(v:unknown)=>unknown)=>s({busy:false}),outputAction:async(f:()=>Promise<unknown>)=>f(),openOutputPanel:vi.fn(),createZonePlayer:(engine:unknown)=>engine,outputKey:()=>['sleep-tests'],readOutputs:()=>({players:[],groups:[]})}))
afterEach(()=>vi.restoreAllMocks())
test('song-count selection saves to the zone rather than a minute timer',async()=>{
 vi.spyOn(outputApi,'sleep').mockResolvedValue({active:false,remaining_seconds:0})
 const save=vi.spyOn(outputApi,'sleepAfterSongs').mockResolvedValue({})
 const q=new QueryClient({defaultOptions:{queries:{retry:false}}})
 render(<QueryClientProvider client={q}><Sleep group={{id:'g',name:'书房',members:[],icon:''} as unknown as OutputGroup}/></QueryClientProvider>)
 const query=getQueriesForElement(elementTree.root!)
 await act(async()=>{fireEvent.tap(query.getByTestId('sleep-mode-songs'))})
 expect(query.getByText('播放几首后休眠')).toBeTruthy()
 await act(async()=>{fireEvent.tap(query.getByTestId('sleep-songs-3'))})
 await act(async()=>{fireEvent.tap(query.getByTestId('sleep-save'));await Promise.resolve()})
 expect(save.mock.calls).toEqual([['g',3]])
 q.clear()
})
