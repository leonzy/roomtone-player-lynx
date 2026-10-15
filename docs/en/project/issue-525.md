# #525: Testing and fixing a 30,000-song playback queue

Related: [songloft-org/songloft#525](https://github.com/songloft-org/songloft/issues/525). On 2026-10-15, baseline testing was followed by the user's additional request to fix Lynx. The original failure evidence remains below.

Delivery authorization (2026-10-15): the user authorized commits/pushes for both Flutter/Lynx fixes and parent gitlinks, plus a reply to this Issue. Uncommitted/unpushed/CI Not run statements below describe the local validation snapshot; GitHub records for the same SHA and the Issue reply determine final delivery and development-package availability. No stable tag or Issue closure.

## Conclusion

**The baseline stalls severely on both Web and the native Android emulator.** The worktree now bounds the queue window and optimizes playback-state saves; post-fix acceptance is listed separately below. The earlier 500-song fix in [Lynx #4](https://github.com/songloft-org/songloft-player-lynx/issues/4) does not establish this scale. Absolute emulator timings are not physical-device performance guarantees.

## Object and method

- Clean Lynx baseline: `e924f05a334254b6eb754927b2808f87a7943302`. Parent: `aedbe1e`; the Flutter fix is locally committed as `bb03a5c`, unpushed.
- Linux amd64, Node 22.17.1, Docker browserless Chrome, 390×900 mobile layout. A real Go backend with an isolated database supplies 30,000 synthetic songs, silent WAV audio and PNG covers. No private audio is used.
- After a production Web build, restore the entire queue through actual IndexedDB at index 15,000. Enter the full player and click its queue button with a mouse. Scripts, logs, artifact hashes and object identification are in `/tmp/songloft-525-lynx/`; see `validation.json`.
- E2E injection, permissions, installations, data resets and emulator copies are confined to this isolated environment. Daily client data and the production database are untouched.

## Web results

| Scenario | Actual result |
|---|---|
| 100-song baseline | Queue opens in approximately 307ms; all 100 rows exist in the DOM, with 1,216 total nodes. After actual scrolling, selecting a track updates it in approximately 129ms; the real audio element advances and there are no page exceptions |
| 30,000 songs, defaults | Restoration is confirmed in stages. There are 100 DOM nodes before opening; the actual queue click is acknowledged within 2ms. Waiting for rows then fails with `Runtime.callFunctionOn` unresponsive for more than 15 seconds; usable queue interaction is not established |
| 30,000 songs, title scrolling preference off | The click is acknowledged within 31ms, followed by the same timeout. Disabling this preference is not a proven workaround |

An initial long run had not completed after 231 seconds, but lacked sufficiently detailed stage markers; 231 seconds is not an exact queue-opening measurement. Later marked runs confirm query timeouts after the click is dispatched. The Chrome container reports zero OOM events. Failed checks are not passes; the unfinished 30,000-song scrolling, switching and removal checks do not inherit the 100-song results.

Implementation review: `PlaylistDrawer` uses `VirtualList`, but the shared wrapper still maps all items and calls `renderItem` for each, including a `ScrollingText` component per row. The 100-song browser DOM also contains offscreen rows. The existing 500-song component test mocks `VirtualList`, proving delegation rather than actual layout or responsiveness at 30,000 songs. CPU/render tracing is still needed to establish the complete bottleneck; these observations do not establish a unique root cause.

Primary evidence: `web-test.log`, `web-results.json`, `web-100-390-open.png`, `web-large-before.png`, `web-large-click.json`, `web-isolated.log`, `web-large-isolated-error.txt`, `web-static.log`, and `web-static-error.txt`. Early selector mistakes were harness corrections, not product failures. The final 100-song run captures actual media-element references.

## Android and automated checks

- `pnpm run build:web`, `SONGLOFT_TEST_BRIDGE=true pnpm run build:android-bundle`, and `./gradlew --no-daemon assembleDebug` pass. Targeted queue, loader and store checks pass: 3 files / 80 tests.
- The final working environment is a clean Android 34 / x86_64 Google APIs emulator, running the same APK's ARM64 libraries through `libndk_translation`, with Xvfb/Mesa llvmpipe, 4 cores / 3GiB, and 320×640 display. Installation ABI and the APK/source binding are checked. Actual login and the E2E store prepare complete queues, followed by real ADB taps on the queue button. Screenshots calibrate the status-bar offset. Notification/battery dialogs are handled only in the isolated device.

| Native scenario | Actual result |
|---|---|
| 100 songs | First row becomes measurable approximately 1,398ms after opening. Removal changes 100→99 without changing the playing song; an actual swipe produces `scrollY=218`; Next changes the track and audio continues. Removal takes approximately 1,157ms and next-track state changes approximately 734ms in this emulator sample |
| 30,000 songs | The store confirms all entries, index 15,000, and current song `Native queue 15000` before tapping. After the actual tap, first-row measurement does not return and hits the native bridge's built-in 15-second deadline. The screenshot still shows the full player without the queue |
| Media during the stall | PID 5586 remains alive. Two `dumpsys media_session` captures show `PLAYING(3)` / speed 1.0 and the same song advancing from 24,576 to 42,651ms. UI unresponsiveness and continuing native audio are independently observed |

Evidence: `native-final-test.log`, `native-results.json` (only the successful 100-song case), `native-error.txt`, `android-30000-before.json`, `android-100-{open,scrolled}.png`, `android-30000-pending.png`, `android-30000-media-{pending,after}.txt`, and `android-final-logcat.log`. Scrolling, removal and Next after the failed 30,000-song opening are incomplete; the 100-song results do not establish them.

Earlier setup failures are retained separately: Android 34/35 x86 attempts encounter emulator exit 139 and SVG `renderWithDiagnostics` JNI errors. Android 35 / 16KiB ARM64 translation encounters ART `Class::FindClassMethod` SIGSEGV before queue loading, with separate `system_server` boot crashes. Logs: `android-logcat.log`, `android-mesa-arm64-logcat.log`, and `android-boot-crash.log`. These are not attributed to 30,000-song playback.

Baseline Not run: valid native interactions after opening 30,000 songs, iOS/HarmonyOS, physical devices and private libraries. The reproduced stall blocks the first. This describes the pre-fix scope; post-fix checks are listed separately.

## Implementation

- `QueueRows` creates only the viewport and eight overscan rows on each side. Two spacers preserve the entire scroll range without truncating queue data; opening locates the current song. Row sizing and offsets share one font-scaled height, with tail offsets clamped to a complete viewport.
- `savePlaybackState` identifies saved immutable queues by array and storage instance. Progress/index updates no longer encode or send the complete queue across the bridge. Queue changes encode 256 songs per batch and yield to the event loop; clears/failures invalidate the saved marker, preserving write ordering.
- Cached songs retain URL-free version-1 snapshots. Independent small keys take precedence for index/progress, with fallback to older envelopes; older clients still cannot mistake snapshots for server songs.
- Regressions exercise bounded mounting at 30,000 songs, distant original indices, both ends and empty queues. The isolated baseline fails the offscreen-row assertion; removing tail clamping fails the offset assertion. Three persistence checks fail against the baseline, covering repeated full writes, blocked input tasks and offline progress.
- Object: baseline `e924f05a334254b6eb754927b2808f87a7943302` plus the uncommitted worktree. SHA-256 of `git diff HEAD -- <files>` for the five source/test files: `20bad72ed9c269fa3b3cdba02e80b156ab546c57a8bac76f2125002f9ece0d60`. Final verification is stored separately in `/tmp/songloft-525-lynx-fix/`, preserving original failure logs.

## Final worktree acceptance

2026-10-15: reuse the isolated Go backend, synthetic 30,000 songs and Android 34 / ARM64 translation environment. The final APK uses clean app data, with APK/embedded-bundle hashes verified. Web uses production output with the test bridge disabled. These are environment-specific samples, including actual input and visible-current-row measurement, not physical-device benchmarks.

| Scenario | Result |
|---|---|
| Web 100 songs / Chinese 390px | Opens in 334ms; 25 mounted rows |
| Web 30,000 songs / Chinese 390px | Opens in 442ms; 25 mounted rows; tail selection updates the song in about 121ms |
| Web 30,000 songs / English 1200px | Opens in 467ms; 26 mounted rows |
| Web 30,000 songs / Chinese large type | Opens in 317ms; 24 mounted rows; current row, title and removal controls visually checked |
| Android 100 songs | Current row visible in 1,389ms; tail selection, removal, Previous/Next and advancing audio pass |
| Android 30,000 songs | Current row visible in 1,632ms; actual scrolling preserves a 2,039,652px range; tapping the tail selects index 29,999. Reopening takes about 2,272ms; removal leaves 29,999 songs / index 29,998. Previous/Next and advancing audio pass |

- All four Web cases exercise real wheel input, tail selection, reopening and removal. IndexedDB actually stores 99 / 29,999 songs and the correct index. Real media elements continue playing, with zero page exceptions.
- Android SharedPreferences independently contains 29,999 songs, index 29,998 and last song `Native queue 29998`. Across automatic progress saving, 20 UI-layout/player-state probes have a maximum response of 35ms, with progress advancing 31,350→46,898ms. No ANR occurred since this boot; native screenshots are visually checked.
- `pnpm exec tsc -b --force`, `pnpm test --maxWorkers=4` (332 files / **3,543 tests**), `pnpm run build` (both Lynx/Web outputs), `node scripts/copy-bundle-web.mjs`, Android Debug build and 81 release checks pass. ReactLynx scans/manual thread review find no new issues; diff, bilingual and UTF-8 checks pass.
- Evidence in `/tmp/songloft-525-lynx-fix/`: `web-final.log` / `web-results.json`, `native-final.log` / `native-results.json`, `native-persistence.json`, `native-heartbeat.json`, `tests-final.log`, `release-tests.log`, `artifacts.sha256`, `validation.json`. Final production Web SHA-256: `cec5067a7bddb65e395b680aef3a6079d404d277c19d2fca67e0dd8a051389ff`; test APK: `4b5f565fc496f63192098a4b38165385b0418effdd48a7e5eed9d324be90dbfa`.
- The intermediate window-only version still stalls on full-queue progress writes. After adding persistence fixes, all affected checks are repeated. First-launch/old-data setup failures and script input-timing failures are not final passes. Final native checks use unique request IDs and viewport assertions instead of accepting pre-layout offscreen rows.

Not run: iOS/HarmonyOS builds/runtime, hardware, private audio, extended background playback and cloud CI. No push has occurred; emulator results do not establish those targets.

## Delivery status

The Lynx fix is uncommitted. No commit, push, release or Issue write has been performed; the parent Lynx gitlink is unchanged. Earlier authorized local Flutter commits are client `bb03a5c` and parent `aedbe1e`.
