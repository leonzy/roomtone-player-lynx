import { afterEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import path from 'node:path'
import ts from 'typescript'
import { getHostCookies } from '../native-platform.js'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('Harmony cookie serialization preserves prototype names and escaped values', () => {
  // Execute the actual method with a controlled ArkWeb store, not a second parser.
  // TypeScript transpilation is not an ArkTS compiler or device acceptance test.
  const source = readFileSync(path.resolve(__dirname, '../../../harmony/entry/src/main/ets/modules/platform/SongloftPlatformModule.ets'), 'utf8')
  const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports: { SongloftPlatformModule?: { prototype: { getCookies: (origin: string, reply: Function) => void } } } = {}
  runInNewContext(js, { exports, LynxModule: class {},
    webview: { WebCookieManager: { fetchCookieSync: () => '__proto__=token; constructor=a=b; session="quoted"; session=last\\value' } },
  })
  const reply = vi.fn()
  exports.SongloftPlatformModule!.prototype.getCookies('https://example.com', reply)
  expect(reply).toHaveBeenCalledOnce()
  expect(reply.mock.calls[0]![0]).toBeNull()
  expect(JSON.parse(reply.mock.calls[0]![1])).toEqual(
    JSON.parse('{"__proto__":"token","constructor":"a=b","session":"last\\\\value"}'),
  )
})

test('Cookie reads wait for the native callback and preserve names and equals signs', async () => {
  let reply!: (error: string | null, json: string | null) => void
  vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {}, getCookies(origin: string, callback: typeof reply) {
    expect(origin).toBe('https://example.com'); reply = callback
  } } })
  const task = getHostCookies('https://example.com')
  reply(null, '{"session":"a=b","__proto__":"value"}')
  expect(await task).toEqual(JSON.parse('{"session":"a=b","__proto__":"value"}'))
  reply('late failure', null)
})

test('old shells, malformed responses and host errors explicitly reject', async () => {
  vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {} } })
  await expect(getHostCookies('https://example.com')).rejects.toThrow('not available')
  for (const json of ['[]', '{"session":42}', 'null', 'invalid']) {
    vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {}, getCookies(_origin: string, reply: Function) { reply(null, json) } } })
    await expect(getHostCookies('https://example.com')).rejects.toThrow()
  }
  vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {}, getCookies(_origin: string, reply: Function) { reply('', null) } } })
  await expect(getHostCookies('https://example.com')).rejects.toThrow('getCookies failed')
})

test('a missing native acknowledgement times out', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('NativeModules', { SongloftPlatform: { openURL() {}, getCookies() {} } })
  const task = expect(getHostCookies('https://example.com')).rejects.toThrow('timeout')
  await vi.advanceTimersByTimeAsync(10000)
  await task
})
