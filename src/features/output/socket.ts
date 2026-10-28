import { appConfig } from '../../core/config/app-config.js'
import { readLynxGlobal, readNativeModules } from '../../native/native-modules.js'
import type { GlobalEventSubscriber } from '../../native/native-audio.js'

export interface PlaybackConnection { send(value: Record<string, unknown>): void; close(): void }
interface Callbacks { open(): void; message(data: Record<string, unknown>): void; close(): void }
interface HostSocket { playbackSocketConnect(id: string, url: string): void; playbackSocketSend(id: string, data: string): void; playbackSocketClose(id: string): void }

/** Ticket-only URLs: access tokens never enter WebSocket URLs or logs. */
export async function connectPlaybackSocket(ticket: string, callbacks: Callbacks): Promise<PlaybackConnection> {
  const base = appConfig.resolvedBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')
  const url = `${base}${appConfig.basePath}/api/v1/playback/events?ticket=${encodeURIComponent(ticket)}`
  const host = readNativeModules()?.SongloftPlatform as Partial<HostSocket> | undefined
  const emitter = readLynxGlobal()?.getJSModule?.('GlobalEventEmitter') as GlobalEventSubscriber | undefined
  if (host?.playbackSocketConnect && host.playbackSocketSend && host.playbackSocketClose && emitter) {
    const id = `output-${Date.now()}-${Math.random()}`
    let closed = false
    const timeout = setTimeout(() => { close(); callbacks.close() }, 10_000)
    const handler = (raw: unknown) => {
      const data = raw as { id?: string; type?: string; data?: string }
      if (closed || data.id !== id) return
      if (data.type === 'open') { clearTimeout(timeout); callbacks.open() }
      if (data.type === 'message') { try { callbacks.message(JSON.parse(data.data ?? '{}')) } catch { /* malformed event */ } }
      if (data.type === 'close' || data.type === 'error') { close(); callbacks.close() }
    }
    const close = () => { if (closed) return; closed = true; clearTimeout(timeout); emitter.removeListener('roomtonePlaybackSocket', handler); host.playbackSocketClose!(id) }
    emitter.addListener('roomtonePlaybackSocket', handler)
    host.playbackSocketConnect(id, url)
    return { send: data => { if (!closed) host.playbackSocketSend!(id, JSON.stringify(data)) }, close }
  }
  const Ctor = typeof WebSocket !== 'undefined' ? WebSocket : undefined
  if (!Ctor) throw new Error('Playback socket requires an updated native client')
  const socket = new Ctor(url)
  let finished = false
  const finish = () => { if (finished) return; finished = true; clearTimeout(timeout); callbacks.close() }
  const timeout = setTimeout(() => { finish(); socket.close() }, 10_000)
  socket.onopen = () => { if (finished) return; clearTimeout(timeout); callbacks.open() }
  socket.onmessage = event => { if (finished) return; try { callbacks.message(JSON.parse(String(event.data))) } catch { /* malformed event */ } }
  socket.onclose = finish
  socket.onerror = () => socket.close()
  return { send: data => { if (!finished && socket.readyState === 1) socket.send(JSON.stringify(data)) }, close: () => { finished = true; clearTimeout(timeout); socket.onclose = null; socket.close() } }
}
