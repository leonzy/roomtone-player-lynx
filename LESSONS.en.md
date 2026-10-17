# Lynx Client Development Lessons

## Scope and Sources

Record dual-thread behavior, shared JS, and four platform hosts in songloft-org/songloft-player-lynx. See the [local AI workflow](docs/en/guides/ai-development.md) and parent host constraints. Existing AGENTS/business references remain authoritative; link evidence rather than duplicating incident histories.

## Recording and Promotion

Include rule, scope, full owner/repo#number, failure/fix commit SHAs, actual validation, and Done right examples (pending if unavailable). Seen counts independent events on distinct dates, not repeated reviews. Three dates make promotion candidates; mark the authoritative destination. Existing hard rules/serious failures apply immediately. Synchronize the [Chinese version](LESSONS.md), never invent counts/resolution/device acceptance, and redact sensitive information.

## Entries

### LYRIC-002: Readable text does not establish visible cover changes

- Scope: Lynx player scrims and lyric foregrounds, songloft-org/songloft#523 feedback on 2026-10-17.
- Evidence: baseline `364607b0cb7a0ed07378e59b27ff6827549fde3e` passed contrast regressions, but the reporter confirmed normal mode remained too faint. New separation tests at both gradient ends failed in light and dark modes on the old implementation; the lower scrim left only 6%/10% artwork.
- Done right: constrain cover separation independently, reduce the veil, and recheck black/white extremes and every built-in palette against 7:1 / 4.5:1 text targets. Verify switching, fallbacks and accessibility restoration in a real browser. Full objects and platform limits are in the [record](docs/en/project/issue-523.md#2026-10-17--stronger-cover-backgrounds).
- Seen 1× (2026-10-17). Status: lesson; currently an uncommitted worktree.

### WEB-002: Desktop mobile viewports do not validate Android Chrome IME or browser controls

- Scope: Web `Input` / `TextArea`, asynchronous controlled-value echoes and fixed navigation; no associated Issue.
- Evidence: on 2026-10-16, baseline `209f6c88b071c187064194a2ae197e48c23fa6c3` reproduces on an Android 34 / Chrome 113 / Gboard emulator. One letter triggers a roughly 9.5ms readonly pulse: DOM focus remains, but the OS dismisses the keyboard. A 912px root exceeds the 856px visible viewport, placing the capsule 48px outside it. Earlier 390px desktop screenshots did not exercise either OS behavior.
- Rule: independently observe OS IME visibility, real continuous/composition input and geometry with browser chrome. Removing the readonly lock alone still lets older echoes overwrite newer edits: the first fix loses `l`, and four additional asynchronous echo tests fail on it. Acknowledge inputs in order; an equal value must not consume later repeated events prematurely.
- Done right: Web avoids temporary readonly changes and skips value echoes already applied by the browser; native locking remains. The host uses dynamic viewport height and Android `resizes-content`. Installed source/distributed controllers pass 36 regressions, the full suite passes 3580, and type checks, dual bundles and 87 release checks pass. Final device results are in the [record](docs/en/project/web-android-input-viewport.md), with evidence under `/home/hanxi/work/songloft-review/android-web-input-20261016/`.
- Follow-up: dynamic viewport resizing also raises fixed capsules above the IME; the previous acceptance incorrectly counted that side effect as a pass. Added acceptance must check hiding during input, no hit targets, restoration after dismissal and uninterrupted playback, beyond fitting navigation inside the reduced viewport. HTTP has no universal precise keyboard API; the same record documents focus/height fallback limits and actual emulator evidence. ADB input requests the IME again and is not physical external-keyboard acceptance.
- Seen 1× (2026-10-16). Status: lesson; a single emulator/browser version does not establish physical Android, latest Chrome or Safari acceptance.

### WEB-001: HTML packaging changes must pass the actual archive verifier

- Scope: embedded Web HTML, copy-bundle-web.mjs and verify-package.py.
- Evidence: on 2026-10-16, local JS/package tests and real browser checks pass at `6edca8561eeaa375c82c725c2cfd097f0ef3f996`, but run `38883061236` fails Web embedded because its regex treats the new base href as an empty asset path. Generic verifier fixtures had not consumed the changed copy output.
- Done right: HTMLParser separates base tags from assets and validates embedded/standalone base policies. The regression archives actual copy output and invokes the verifier, then removes a real asset to ensure missing files still fail. The old verifier fails this new regression; the fix passes 85 release checks and the exact CI archive command. Evidence: `logs/{lynx-ci-web-job,archive-verifier-negative,lynx-release-tests-archive-fix}.log` under `/home/hanxi/work/songloft-review/lynx-default-20261016/`.
- Seen 1× (2026-10-16). Status: lesson; delivery records the fix commit and subsequent CI. Cancelled old builds do not count as passing.

### LYRIC-001: Explain when accessibility disables cover backgrounds

- Scope: Lynx player and appearance settings; songloft-org/songloft#523 feedback on 2026-10-16.
- Evidence: an actual Web build of baseline `1ad0eaf1cba340d644660f64198fed6b8b6d6d6d` unmounts the cover and shows a solid background with either Increase Contrast or Reduce Transparency. Old descriptions only mentioned labels/separators or solid surfaces. The screenshots match this path, but device settings remain unconfirmed.
- Done right: disable each option through the real settings UI and confirm the cover returns; clarify the effect in both languages while retaining the accessibility policy. Screenshot similarity does not prove a device cause. See the [#523 follow-up record](docs/en/project/issue-523.md) for comparisons and commands.
- Seen 1× (2026-10-16). Status: lesson; copy was uncommitted during validation, with final validation objects in the task record.

### LIST-001: Delegating to a virtual list does not establish large-queue runtime performance

- Scope: playback queues, shared `VirtualList`, Web and native runtimes, songloft-org/songloft#525.
- Evidence: on 2026-10-15, all 80 relevant tests pass at baseline `e924f05a334254b6eb754927b2808f87a7943302`; the 500-song test mocks the list and verifies delegation. An actual 30,000-song queue causes Web query timeouts after clicking and hits the native bridge's 15-second deadline on Android 34 with ARM64 translation, while its media session continues playing the same song.
- Rule: component names, native layout virtualization and mocked structural assertions do not prove that background JS processes only visible rows. Check JS construction, layout, measurement, interaction and media progress at the actual scale. Passing at 100/500 songs does not establish 30,000 songs.
- Done right: bound row creation to the viewport and keep font-scaled sizing/offsets aligned. Progress saves update small keys; queue changes encode in batches. The final 3,543-test suite, four Web cases and native Android 30,000-song opening/tail/removal/navigation checks pass. During automatic saving, 20 UI probes respond within 35ms. See the [#525 record](docs/en/project/issue-525.md) for objects, baseline failures, final evidence and Not run.
- Seen 1× (2026-10-15). Status: lesson; the fix is uncommitted and this incident does not increment Seen. Hardware and other native platforms remain unverified.

### RELEASE-001: Send confirmation prompts to stderr and fail on cancellation

- Scope: `scripts/bump-version.mjs` and command substitution in the parent release orchestrator.
- Rule: reserve stdout for the successful version result; send plans/prompts to stderr immediately. Enter, rejection and EOF must cancel with a nonzero exit so orchestration stops; input handling must terminate cleanly on EOF.
- Evidence: on 2026-10-15, baseline `0de993ff272ee29df96c8401b46df56256646438` hid prompts when the parent captured stdout and returned 0 on Enter. All 5 new relevant checks failed against the original implementation and pass after the fix. Full record and Not run: [handoff](docs/en/project/handoff.md#2026-10-15--release-confirmation).
- Done right: all 81 release-tool tests pass. A PTY with actual command substitution shows the version and prompt before input; Enter exits 1 without writes, and yes creates only the expected local commit/tag, preserving fixture remote refs. Evidence: `/tmp/songloft-release-terminal-result.json`.
- Seen 1× (2026-10-15). Status: lesson; no commits, pushes or actual releases performed by this task.

### UI-003: A correct color getter does not update persistent SVGs

- Scope: built-in palettes, server packs and persistent navigation, songloft-org/songloft#523.
- Rule: ThemeProvider updating inherited CSS variables does not rerender identical children. Native SVGs need their persistent owner to subscribe explicitly. Inspect rendered SVG content and actual icon/text/selection screenshots instead of only calling a color getter.
- Evidence: On 2026-10-15, this batch's initial screenshot on baseline `4d73b793890494301d44b1a19e9df4dd178429e3` showed Rose text/background with a blue navigation gear, although getter assertions passed. The isolated original ShellLayout fails the rendered `#984061` assertion. Explicit palette/pack subscriptions pass 13 navigation regressions and the final 3531-test suite. See the [batch record](docs/en/project/issue-523.md) for the source fingerprint and retained screenshots.
- Done right: ShellLayout subscribes to `subscribeBuiltInPalette` / `subscribeActiveThemePack`; the same mounted SVG follows Blue → Rose → pack → restored Rose. Browser checks assert rendered SVGs match the root accent for all six palettes.
- Seen 1× (2026-10-15). Status: lesson; below the three-date promotion threshold.

### UI-002: Slider release and bounds measurement must belong to one gesture

- Scope: shared lynx-ui 3.135.4 sliders and older native-shell capabilities, songloft-org/songloft#520.
- Rule: Release must be recorded even before value updates begin, then commit the same gesture's last position after its bounds arrive. Reject earlier gestures/unmounted callbacks and measure rail/fill separately.
- Evidence: On 2026-10-14, the library at baseline `992eb4930bc686f7160a1ca0bfbab42368dad284` lost commit when release preceded `getRectByRef`, while a late callback could start dragging. The actual-controller fixture fails three tests with the original library and passes four after patching. API 34 measured cache-fill width as zero; displayed labels/ticks do not prove the fill or gesture works. Evidence: `/tmp/songloft-520-slider-{negative,final}-test.log`, [#520 record](docs/en/project/issue-520.md).
- Done right: Lock source/dist patches covering short taps, the final move, interleaved measurements and unmount. Give the inner fill explicit width/centering. Older Android `exitApp` only backgrounds, so the new JS entry consumes host capability `androidExitAppStopsPlayback` and stays hidden on old shells; method existence alone is insufficient.
- Coordinate evidence: API 34 touch x=196.36 and measured left=0 yielded ratio 0.597 for the visible midpoint. The common helper passed relativeTo:'', returning local bounds despite LynxView-relative touches. Use null for native bounds and screen for Web clientX. The final controller suite passes 8 tests; the original fails 7. Actual device/server endpoints and midpoint values persist correctly. See `/tmp/songloft-520-coordinate-{tests,negative}-final.log` and `/tmp/songloft-520-lynx-{device,server}-final.json`.
- Wrapper follow-up: ProgressBar also discarded its first value through a pre-render dragging closure, unlike the size/font sliders that seed their preview. Two wrapper regressions fail before the fix and pass after; API 34 taps at 25%/50%/75% reach the matching 30/60/90-second positions without stopping playback. This is follow-up validation of the same incident, not an extra Seen event.
- Not run: HarmonyOS 4.2 hardware. Standard Android did not reproduce all reported touch symptoms; deterministic shared regressions do not accept that device.
- Seen 1× (2026-10-14). Status: lesson; final native/persistence evidence is in the batch record.

### TEST-001: Run artifact-reading tests after builds finish

- Scope: Lynx/Web builds and release artifact gates.
- Rule: builds clean `dist/`; tests reading `dist/main.lynx.bundle` must not run concurrently with a build. Complete the dual build and Web packaging before the full test suite.
- Failure: on 2026-10-14, songloft-org/songloft#520 ran builds and tests concurrently in the uncommitted worktree based on `a69a45f4c3048171ddbc1f0f33c9922fa3af74d8`. `release-build.test.ts` failed with `ENOENT`; log: `/tmp/songloft-520-lynx-tests.log`. This is a verification orchestration failure, not a source regression or grounds to skip the gate.
- Done right: sequential execution after building passed 3494 tests in `/tmp/songloft-520-lynx-tests-final.log`. Final verification after adding lyrics visibility cases is recorded in [#520](docs/en/project/issue-520.md).
- Seen 1× (2026-10-14). Status: lesson.

### UI-001: Verify scroll hints against visible songs and host callback shapes

- Scope: virtual-list positioning, initials and numeric hints (songloft-org/songloft#518).
- Rule: a visible bubble does not prove positioning. Native `attachedCells` uses list-relative coordinates; Web's `getVisibleCells` array cache can lag, so use binary searches over actual row bounds. Supply a realistic Web placeholder-height estimate; scroll offset divided by row height is only provisional. Keep one row-bound read in flight, coalesce the latest pending position, and revisit it afterward to avoid backlog or losing the final scroll. Reject stale callbacks. A void `scrollToPosition` success does not prove new rows have committed; require visible-destination confirmation with bounded retries.
- Failure evidence: on 2026-10-14, the initial uncommitted browser implementation displayed row 14 while the hint remained at row 1. `/tmp/songloft-518-ui/lynx-full-drag.png`, `lynx-debug.json` and installed web-elements source confirm the callback differences.
- Fix evidence: the current uncommitted worktree normalizes visible cells, follows actual scroll events, finishes void invokes, estimates song placeholders at 64px and paginates destinations; Git identifies the eventual commit. Tests cover native objects, Web array coordinates, immutable query chains, interleaved callbacks and settled positions without a subsequent scroll event. Both final browser runs continue to offset=100; at scroll offset 6592, row 104, “夜空中最亮的星”, appears at the list top with `Y` and `104 / 130` in the hint. See `/tmp/songloft-518-ui/lynx-final-{result,repeat}.json` and the validation object in the [batch record](docs/en/project/issue-518.md).
- Done right: verify bubbles, visible rows, real page requests and restored preferences separately. Keep hints visible throughout a held drag and confirm virtual rows that settle after the last scroll event. When the viewport has not moved, a newer pending query must not invalidate a valid response; reject responses older than an already-applied result instead. Browser assertions record held and released hints separately. Cancel old positioning and query timers on navigation.
- Seen **1×**: 2026-10-14. Status: lesson; native devices remain unverified, and Web evidence is not native acceptance.

### API-001: Validate Upgrade Payloads Against the Backend Channel Contract

- Scope: Lynx backend update checks, start requests, and page tests.
- Rule: A write mock returning 200 for any body cannot prove an upgrade action works. Check the running channel, its version/notes, and actual POST JSON. Online upgrades stay on the current stable/dev channel; non-Docker deployments have no action.
- Failure evidence: [songloft-org/songloft-player-lynx#11](https://github.com/songloft-org/songloft-player-lynx/issues/11) screenshot and baseline [`0651222`](https://github.com/songloft-org/songloft-player-lynx/commit/0651222b87b5a97daebef7e48c5d497c32a7e71a): the widget sent `{}`, rejected by the backend for missing `version_type`; the old mock did not inspect the payload.
- Fix evidence: source worktree `faec7a428a9675dc1d3e5c98191d963555b8616c409e93658daae6f651e8389b`; five regressions fail with the isolated old widget, the final 36 related tests pass, and browser records confirm dev/stable payloads and rejection/retry. See [progress](docs/project/progress.md). Actual binary replacement and Android devices remain untested; the Git commit containing this entry records the fix.
- Done right: `SettingsApi.startUpgrade(channel)` sends `{version_type: channel}`. About tests use the real API class, transport tests inspect JSON, and browser fixtures reject the wrong channel and record requests, beyond button-presence checks.
- Seen **1×**: 2026-10-14. Existing API rules apply; the three-date promotion threshold has not been met.
