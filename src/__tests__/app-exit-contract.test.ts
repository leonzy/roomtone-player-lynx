import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const base = process.env.SONGLOFT_EXIT_NATIVE_ROOT ?? 'android/app/src/main/java/org/songloft/lynx/'
const read = (path: string) => readFileSync(base + path, 'utf8')

test('explicit exit and root back share cleanup instead of backgrounding', () => {
  const module = read('navigation/SongloftNavigationModule.kt')
  const back = read('MainActivity.kt').match(/override fun onBackPressed\(\) \{([\s\S]*?)\n    \}/)?.[1]
  expect(module).toMatch(/if \(host is Activity\) AppExit\.exit\(host\)/)
  expect(module).not.toMatch(/host\.moveTaskToBack\(/)
  expect(back).toMatch(/!BackKeyState\.shouldForward\(\)[\s\S]*?AppExit\.exit\(this\)/)
  expect(read('MainActivity.kt')).toMatch(/props\["androidExitAppStopsPlayback"\] = true/)
})

test('native exit releases playback and overlays before removing the task', () => {
  const exit = read('navigation/AppExit.kt')
  const cleanupList = exit.match(/listOf<\(\) -> Unit>\(([\s\S]*?)\n            \)/)?.[1] ?? ''
  const actions = [...cleanupList.matchAll(/\{ (.*?) \},/g)].map(m => m[1])
  expect(actions).toEqual([
    'SongloftAudioEngine.stop()',
    'activity.stopService(Intent(activity, SongloftPlaybackService::class.java))',
    'activity.stopService(Intent(activity, FloatingLyricService::class.java))',
    'activity.finishAndRemoveTask()',
  ])
  expect(exit).toMatch(/main\.post \{[\s\S]*?cleanup\(\)[\s\S]*?catch[\s\S]*?main\.postDelayed/)
})
