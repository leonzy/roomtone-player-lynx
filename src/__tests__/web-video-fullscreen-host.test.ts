import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { afterEach, expect, test, vi } from 'vitest'

const source = readFileSync(resolve(__dirname, '../../web/video-fullscreen-host.js'), 'utf8')
interface Snapshot {
  supported: boolean
  active: boolean
  needsGesture?: boolean
}
interface Host {
  set(enabled: boolean, label: string): Promise<Snapshot>
  close(): Promise<Snapshot>
  dispose(): Promise<Snapshot>
}
const hosts: Host[] = []
afterEach(async () => {
  await Promise.all(hosts.splice(0).map((host) => host.dispose()))
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
function setup() {
  let fullscreen: Element | null = null
  let open = true
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreen,
  })
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
  const enter = vi.fn(async () => {
    fullscreen = document.documentElement
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  const exit = vi.fn(async () => {
    fullscreen = null
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: enter,
  })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit })
  const context = {
    window: {} as {
      __SONGLOFT_CREATE_VIDEO_FULLSCREEN__?: (
        doc: Document,
        opened: () => boolean,
        notify: (state: Snapshot) => void,
      ) => Host
    },
  }
  vm.runInNewContext(source, context)
  const notify = vi.fn()
  const host = context.window.__SONGLOFT_CREATE_VIDEO_FULLSCREEN__!(document, () => open, notify)
  hosts.push(host)
  return {
    host,
    enter,
    exit,
    notify,
    setOpen: (value: boolean) => {
      open = value
    },
    setFullscreen: (value: Element | null) => {
      fullscreen = value
    },
  }
}

test('enters the shared document root and exits only fullscreen owned by the video', async () => {
  const { host, enter, exit, notify, setFullscreen } = setup()
  expect((await host.set(true, '全屏')).active).toBe(true)
  expect(enter).toHaveBeenCalledTimes(1)
  await host.close()
  expect(exit).toHaveBeenCalledTimes(1)
  expect(notify).toHaveBeenLastCalledWith({ supported: true, active: false })
  setFullscreen(document.body)
  await host.close()
  expect(exit).toHaveBeenCalledTimes(1)
})

test('activation rejection offers a real click retry without replacing video/subtitles', async () => {
  const { host, enter } = setup()
  const video = document.createElement('video')
  document.body.append(video)
  enter.mockRejectedValueOnce(new Error('Activation expired'))
  expect((await host.set(true, '点击全屏')).needsGesture).toBe(true)
  const button = document.querySelector<HTMLButtonElement>('[data-songloft-fullscreen]')!
  expect(button.textContent).toBe('点击全屏')
  button.click()
  await vi.waitFor(() => expect(button.isConnected).toBe(false))
  expect(enter).toHaveBeenCalledTimes(2)
  expect(video.isConnected).toBe(true)
})

test('late fullscreen permission cannot leave a closed video fullscreen', async () => {
  const { host, enter, exit, setFullscreen, setOpen } = setup()
  let complete!: () => void
  enter.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        complete = () => {
          setFullscreen(document.documentElement)
          resolve()
        }
      }),
  )
  const pending = host.set(true, '全屏')
  setOpen(false)
  await host.close()
  complete()
  expect((await pending).active).toBe(false)
  expect(exit).toHaveBeenCalledTimes(1)
  expect(document.querySelector('[data-songloft-fullscreen]')).toBeNull()
})
