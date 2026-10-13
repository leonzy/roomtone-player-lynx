import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf8')
const engine = read('ios/SongloftLynx/SongloftAudioEngine.swift')

// These verify platform wiring only; the Swift verifier executes the actual
// task owner separately. UIKit/AVPlayer compilation and device behavior remain gates.
function body(source: string, name: string): string {
  const start = source.indexOf(`func ${name}(`)
  expect(start, name).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  let depth = 1
  let end = open + 1
  for (; depth > 0 && end < source.length; end++) {
    if (source[end] === '{') depth++
    if (source[end] === '}') depth--
  }
  expect(depth, name).toBe(0)
  return source.slice(open + 1, end - 1).replace(/\s+/g, ' ')
}

test('source preparation asynchronously loads tracks, checks generation and preserves play intent', () => {
  const load = body(engine, 'load')
  expect(load).toContain('asset.loadTracks(withMediaType: .audio)')
  const callback = load.slice(load.indexOf('asset.loadTracks'))
  expect(callback.indexOf('self.runOnMain')).toBeLessThan(callback.indexOf('buildAudioMix'))
  expect(callback.indexOf('self.loadGeneration == generation, self.preparingAsset === asset')).toBeLessThan(callback.indexOf('player.replaceCurrentItem'))
  expect(callback).toContain('if self.pendingAutoplay && self.pendingInitialPositionMs == nil { self.play() }')
  expect(body(engine, 'play')).toContain('if isPreparingSource || pendingInitialPositionMs != nil { return }')
  expect(body(engine, 'seek')).toMatch(/if isPreparingSource \|\| pendingInitialPositionMs != nil \{\s*pendingInitialPositionMs = max\(0, positionMs\)/)
  expect(body(engine, 'invalidatePreparation')).toContain('preparingAsset?.cancelLoading()')
  expect(load).toContain('presentationSizeObservation = nil')
  expect(body(engine, 'installPresentationSizeObserver')).toContain('self.player?.currentItem === item')
  expect(callback.indexOf('player.replaceCurrentItem')).toBeLessThan(callback.indexOf('self.installPresentationSizeObserver()'))
  expect(read('ios/SongloftLynx/AudioEqualizer.swift')).not.toMatch(/\.tracks\(withMediaType:/)
})

test('latest initial seek wins across asset preparation, readiness and earlier seek callbacks', () => {
  expect(body(engine, 'seek')).toContain('item.status == .readyToPlay { seekInitialPosition(of: item) }')
  expect(body(engine, 'onItemStatus')).toContain('if pendingInitialPositionMs != nil { seekInitialPosition(of: item) }')
  const seek = body(engine, 'seekInitialPosition')
  expect(seek).toContain('initialSeekGeneration += 1')
  expect(seek).toContain('self.loadGeneration == expectedLoad, self.initialSeekGeneration == expectedSeek')
  expect(seek.indexOf('self.initialSeekGeneration == expectedSeek')).toBeLessThan(seek.indexOf('self.pendingInitialPositionMs = nil'))
})

test('background gaps are protected before completion dispatch and on buffering/background entry', () => {
  const completed = body(engine, 'onReachedEnd')
  expect(completed).toContain('protectPlaybackGap(force: true)')
  expect(completed.indexOf('protectPlaybackGap(force: true)')).toBeLessThan(completed.indexOf('emitState("completed")'))
  const status = body(engine, 'onTimeControlStatus')
  expect(status).toContain('self.player === player')
  expect(body(engine, 'ensurePlayer')).toContain('self?.runOnMain { self?.onTimeControlStatus(of: player) }')
  expect(status).toMatch(/case \.playing:\s*backgroundTask\.end\(\)/)
  expect(status).toMatch(/case \.waitingToPlayAtSpecifiedRate:\s*protectPlaybackGap\(\)/)
  expect(body(engine, 'protectPlaybackGap')).toContain('UIApplication.shared.applicationState == .background')
  expect(body(engine, 'installLifecycleObservers')).toMatch(/didEnterBackgroundNotification[\s\S]*?self\?\.protectPlaybackGap\(\)/)
  expect(body(engine, 'installLifecycleObservers')).toMatch(/willEnterForegroundNotification[\s\S]*?self\?\.backgroundTask\.end\(\)/)
  expect(engine).toContain('beginBackgroundTask(')
  expect(engine).toContain('endBackgroundTask(')
  expect(engine).toContain('task == .invalid ? nil : task.rawValue')
})

test('explicit pause, stop and disposal release tasks; errors keep the same finite window through backoff', () => {
  for (const name of ['pause', 'stop', 'release']) {
    expect(body(engine, name)).toContain('pendingAutoplay = false')
    expect(body(engine, name)).toContain('backgroundTask.end()')
  }
  for (const name of ['stop', 'release', 'load']) {
    expect(body(engine, name)).toContain('invalidatePreparation()')
  }
  expect(body(engine, 'load')).toContain('self.protectPlaybackGap(force: true)')
  expect(body(engine, 'onItemStatus')).toMatch(/case \.failed:[\s\S]*?protectPlaybackGap\(force: true\)/)
  expect(body(engine, 'play')).not.toContain('backgroundTask.end()')
  expect(body(engine, 'release')).toContain('NotificationCenter.default.removeObserver(observer)')
})

test('the native task owner is an app source and its executable verifier is wired into Apple CI', () => {
  const project = read('ios/SongloftLynx.xcodeproj/project.pbxproj')
  for (const section of ['PBXBuildFile', 'PBXFileReference', 'PBXGroup', 'PBXSourcesBuildPhase']) {
    const content = project.split(`/* Begin ${section} section */`)[1]?.split(`/* End ${section} section */`)[0]
    expect(content, section).toContain('PlaybackBackgroundTask.swift')
  }
  expect(read('.github/workflows/build-and-release.yml')).toContain('swiftc -swift-version 5 ios/SongloftLynx/PlaybackBackgroundTask.swift scripts/verify-ios-playback-background.swift')
  expect(read('.github/workflows/build-and-release.yml')).toContain('node scripts/verify-ios-playback-preparation.mjs')
})
