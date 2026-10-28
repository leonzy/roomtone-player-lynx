import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectPlaybackSocket } from '../socket.js'

const native = vi.hoisted(() => ({ host: undefined as Record<string, unknown> | undefined, emitter: undefined as unknown }))
vi.mock('../../../native/native-modules.js', () => ({ readNativeModules: () => native.host ? { SongloftPlatform: native.host } : undefined, readLynxGlobal: () => native.emitter ? { getJSModule: () => native.emitter } : undefined }))
vi.mock('../../../core/config/app-config.js', () => ({ appConfig: { resolvedBaseUrl: 'https://music.example', basePath: '/room' } }))
class FakeSocket {
  static instance: FakeSocket
  readyState = 1
  onopen: null | (() => void) = null
  onmessage: null | ((event: { data: string }) => void) = null
  onclose: null | (() => void) = null
  onerror: null | (() => void) = null
  send = vi.fn()
  close = vi.fn(() => this.onclose?.())
  constructor(public url: string) { FakeSocket.instance = this }
}
beforeEach(() => { vi.useFakeTimers(); native.host = undefined; native.emitter = undefined; vi.stubGlobal('WebSocket', FakeSocket) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
const callbacks = () => ({ open: vi.fn(), close: vi.fn(), message: vi.fn() })

test('web ticket connection scopes the URL, ignores malformed messages and closes once', async () => {
  const events = callbacks(), connection = await connectPlaybackSocket('one/use', events)
  const socket = FakeSocket.instance
  expect(socket.url).toBe('wss://music.example/room/api/v1/playback/events?ticket=one%2Fuse')
  socket.onopen!(); socket.onmessage!({ data: '{' }); socket.onmessage!({ data: '{"cmd":"pause"}' })
  expect(events.message).toHaveBeenCalledExactlyOnceWith({ cmd: 'pause' })
  connection.send({ type: 'report' }); expect(socket.send).toHaveBeenCalledWith('{"type":"report"}')
  socket.onerror!(); socket.onclose?.(); expect(events.close).toHaveBeenCalledTimes(1)
  socket.onmessage!({ data: '{"cmd":"play"}' }); expect(events.message).toHaveBeenCalledTimes(1)
  connection.send({ type: 'report' }); expect(socket.send).toHaveBeenCalledTimes(1)
})
test('web handshake timeout reconnects once; intentional disposal does not reconnect', async () => {
  const events = callbacks(); await connectPlaybackSocket('ticket', events)
  await vi.advanceTimersByTimeAsync(10_000)
  expect(events.close).toHaveBeenCalledTimes(1)
  const disposed = callbacks(), connection = await connectPlaybackSocket('ticket', disposed)
  connection.close(); await vi.advanceTimersByTimeAsync(10_000)
  expect(disposed.close).not.toHaveBeenCalled()
})
test('native events are isolated by socket identity and disposal removes the listener', async () => {
  let handler!: (data: unknown) => void
  const addListener = vi.fn((_name: string, fn: typeof handler) => { handler = fn }), removeListener = vi.fn()
  const connect = vi.fn(), send = vi.fn(), close = vi.fn()
  native.emitter = { addListener, removeListener }
  native.host = { playbackSocketConnect: connect, playbackSocketSend: send, playbackSocketClose: close }
  const events = callbacks(), connection = await connectPlaybackSocket('ticket', events)
  const id = connect.mock.calls[0]![0]
  handler({ id: 'other', type: 'open' }); expect(events.open).not.toHaveBeenCalled()
  handler({ id, type: 'open' }); handler({ id, type: 'message', data: '{"cmd":"stop"}' })
  expect(events.open).toHaveBeenCalledTimes(1); expect(events.message).toHaveBeenCalledWith({ cmd: 'stop' })
  connection.send({ type: 'report' }); expect(send).toHaveBeenCalledWith(id, '{"type":"report"}')
  connection.close(); handler({ id, type: 'close' })
  expect(removeListener).toHaveBeenCalledWith('roomtonePlaybackSocket', handler)
  expect(close).toHaveBeenCalledExactlyOnceWith(id); expect(events.close).not.toHaveBeenCalled()
})
