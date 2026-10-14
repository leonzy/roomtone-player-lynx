# Keep Screen On for Lyrics · songloft-org/songloft#520

2026-10-14. This batch implements only the screen-awake preference; exit behavior is deferred at the user's request.

## Implementation and Boundaries

Settings → Playback → Lyrics → Keep screen on for lyrics follows the open-lyrics-on-launch option. It is off by default, with device-local key `player_lyrics_keep_screen_on`. Late hydration cannot overwrite a new choice; rapid writes are serialized.

Only request while `/player` is current, a song exists, layout measurement is complete and lyrics are visible. Mobile returns to the cover, player child routes and unmounting release the request. Wide side-by-side lyrics also apply; pausing does not cancel screen-awake while viewing lyrics.

`SongloftPlatform.setKeepScreenOn(bool)` is a fire-and-forget method in all three native hosts. Android sets the window flag on the main thread; the OS permits background screen sleep. iOS combines the request with scene activity and clears it on inactivity/root destruction. HarmonyOS combines it with Ability foreground state, serializes window writes and releases destroyed/replaced windows. Older shells safely degrade and require a new native package for this capability. Web bridges the Worker to main-thread Screen Wake Lock, acquires while visible, releases when hidden/reacquires on return and releases late acquisitions. Unsupported/denied requests do not interrupt playback.

## Validation

- Repository: `songloft-org/songloft-player-lynx`; baseline `a69a45f4c3048171ddbc1f0f33c9922fa3af74d8` plus uncommitted worktree. Source SHA-256: `060b520c51d9b841dd8953e5e3925059ed0c968f4d6688bc669bc24da31f4c42`. Algorithm/scope: `/tmp/songloft-520-validation.json` (source diff plus in-scope untracked paths/content; documentation excluded).
- Linux, Node 22.17.1, pnpm 11.15.1. `pnpm exec tsc -b`, dual-output `pnpm run build`, and `pnpm run build:web` passed. After builds finished, `pnpm test` passed 324 files / 3496 tests. Logs: `/tmp/songloft-520-lynx-{types-final,build-final,web-build-final,tests-final2}.log`.
- After `node scripts/copy-bundle-android.mjs`, `cd android && ./gradlew --no-daemon assembleDebug` passed with final JS/new host method. Log: `/tmp/songloft-520-lynx-android-final.log`.
- Node files testing Web late acquisitions and HarmonyOS foreground/window replacement passed. ArkTS tests execute actual source via TypeScript adapters and **do not compile ArkTS**. Removing Web late-acquisition release in an isolated copy failed the expected assertion. Logs: `/tmp/songloft-520-{web-host-tests-final,harmony-host-tests-final,web-negative}.log`.
- Docker `browserless/chrome:latest`, final embedded Web, 420×900: real login/playback-settings/toggle saved IndexedDB `prefs.player_lyrics_keep_screen_on` as `true`. On settings, `requested/held/pending` stayed false, proving the setting itself does not hold the display awake on that page. Screenshot: `/tmp/songloft-520-lynx-toggle-final.png`; result: `/tmp/songloft-520-lynx-settings-ui-final.json`. UI backend/database were isolated, with synthetic audio.
- Formatting, diff and UTF-8 checks passed. Not run: iOS Xcode and HarmonyOS HAP builds (toolchains unavailable), native-device sleep/power policy (no connected devices). UI/controller tests do not replace these checks.

The validation above ran before committing; the user subsequently authorized commits, pushes and an Issue reply. Client commits come first, followed by their actual SHAs in the parent repository. Git records final commits, and workflows for the same SHA determine subsequent CI/development-package status. This batch does not tag a stable release; existing v0.1.1 packages lack the new method. Download guidance must distinguish Android APK from HarmonyOS NEXT HAP (minimum `5.0.1(13)`); the reporter's 4.2 system should not be treated as meeting NEXT package requirements.
