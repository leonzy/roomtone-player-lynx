# Android Chrome: Soft Keyboard and Bottom Navigation Regression

On 2026-10-16, the user reported that typing one letter dismissed the keyboard in the full server's Lynx Web client and that the navigation capsule extended below the screen. [中文](../../project/web-android-input-viewport.md).

## Validation Target

- Parent baseline: `eebd27d84577ca2de037b6b7db176b13d48c91c6`; Lynx baseline: `209f6c88b071c187064194a2ae197e48c23fa6c3`. Reproduce with the actual published dev Linux full binary before testing this source working tree.
- Isolated Android 34 / x86_64 emulator, 432×960 at 160dpi, Chrome `113.0.5672.136`, Gboard. One-letter input touches the actual Gboard A key; continuous input uses ADB. Chinese composition uses Chrome `Input.imeSetComposition` / `Input.insertText`; a DOM range-edit event checks caret behavior through echoes. CDP observes DOM/composition/media state, and `dumpsys input_method` independently verifies keyboard visibility. This is not desktop Chrome with a mobile viewport.
- Temporary databases and three synthetic MP3/LRC tracks. Evidence, commands, screenshots, source fingerprints and final results are under `/home/hanxi/work/songloft-review/android-web-input-20261016/`; `validation.json` identifies the accepted working tree/artifacts.

## Reproduced Causes

1. Controlled `Input` / `TextArea` in `lynx-ui-input@3.135.4` set `readonly` on the main thread for every edit, then unlock after the background callback. Android Chrome withdraws the IME connection. Baseline `admin → admina` shows a roughly 9.5ms readonly pulse: DOM focus remains, while the system's `mInputShown` changes from true to false.
2. The host `lynx-view` uses `100vh`, which includes space reclaimed by the collapsed address bar. With browser chrome expanded, the baseline visible viewport is 856px, the Lynx root is 912px, and navigation ends at 904px: 48px outside the visible area. web-core containment positions fixed navigation relative to that oversized host box.
3. Disabling the Web readonly lock alone is insufficient: an older background value effect can overwrite newer browser edits. The first fix loses `l` during real continuous alphabet input. Four additional tests execute the actual controller across delayed value effects; all fail on that first fix.

## Fix

- A pnpm patch maintains both source and distributed JSX for `Input` / `TextArea`. Detect Web through `SystemInfo.platform` in the Worker; Web avoids temporary readonly changes, while native and unknown platforms retain controlled locking.
- The Web background controller records received edits in order and acknowledges/skips their value-effect echoes. This prevents older render echoes from disrupting newer text, caret position or composition. Initial values and external changes distinct from input echoes still use `setValue`.
- Only the Web host HTML adds `100dvh` after its `100vh` fallback and requests `interactive-widget=resizes-content`, so Android Chrome resizes the layout viewport for the IME. Shared native navigation offsets are unchanged.
- The lockfile adds only the input patch and preserves other dependency versions. Reference: [Chrome's official viewport explanation](https://developer.chrome.com/blog/viewport-resize-behavior).

## Acceptance and Limits

Commands, source/artifact hashes, actual Android root/subpath results and screenshots are in the evidence directory. New tests execute both installed source and distributed controllers, covering Web/native locks, composition, delayed/batched echoes, repeated values and external resets. The original baseline fails nine checks; the asynchronous echo defect fails another four.

Final local results: 3580 Vitest checks, type checks, Lynx/Web dual bundles, Go embedding and 87 release checks pass. Actual Android interactions pass eight checks each on localhost root, LAN HTTP root and the `/songloft/` subpath. Four additional checks cover multiline input, actual landscape rotation, portrait restoration and a 360×800 display, totaling 28. Media time, OS keyboard visibility and DOM geometry are independently asserted, with visual screenshot inspection. Proxy settings are edited as a draft only; test addresses are never saved.

Not run: physical Android devices, newer Chrome versions, an actual Pinyin keyboard's candidate-selection flow, real Safari/Firefox, and native iOS/HarmonyOS runtime behavior. Desktop headless results cannot replace the emulator's explicit browser/platform boundaries. Delivery records determine final commits, pushes and CI status.

## Follow-up: Hide floating capsules while the keyboard is open

The user subsequently reported the capsule tab bar rising above the keyboard. Published dev at parent `a1d01de31d93ecabe908b73d0740576a9f57a753`, Lynx `e69cef902afd57661301fc76642bb8980273811e`, reproduces this: visible height shrinks from 856px to 544px and navigation moves from bottom 848px to 536px, remaining hittable. The previous acceptance treated following the reduced viewport as correct and missed the requirement to keep navigation from floating above the keyboard during editing.

`viewport-keyboard-host.js` observes real edit focus, keyboard geometry when available, and viewport changes on the browser main thread. LAN HTTP lacks the dedicated keyboard API, so the fallback requires touch capability, edit focus and a significant height reduction together. It stores baselines by width and uses screen height and browser chrome occupancy during rotation. Zoom is normalized by scale; ordinary focus, small toolbar changes and window changes without an editor cannot trigger hiding. Focus transfers retain the hidden state until the occupied area is gone. Browser keyboard overlay policy is unchanged.

The host injects a style only into its own Lynx shadow root, hiding bottom navigation and the narrow floating mini-player along with their hit targets and accessibility subtrees. Components and audio remain mounted; keyboard dismissal preserves selected tabs and playback. `100dvh`, `resizes-content` and the existing continuous-input/caret fixes remain.

This batch's evidence, baseline failure assertion, final working-tree fingerprints, builds and device results are under `/home/hanxi/work/songloft-review/android-web-keyboard-nav-20261016/`. Actual-device scripts check OS IME state, zero-size/unhittable hidden controls, rotation back to portrait, Back-key dismissal/restoration, both capsules hiding during library search and real media time advancing. Proxy edits remain unsaved drafts. The directory's `validation.json` and delivery records identify final passes, commits and dev artifacts.

During actual rotation the IME sometimes remains shown and sometimes closes; requiring it to stay open throughout is not a requirement of this navigation fix. The script waits for stable, mutually consistent viewport and OS state, asserts hiding or restoration accordingly, then actually taps the editor to reopen the keyboard and verifies hiding again.

Final local validation passes 3593 Vitest checks (including 12 new host regressions), type checks, dual bundles, standalone Web/Go embedding and 87 release checks. The final embedded package passes 15 actual Android checks each on LAN root, the `/songloft/` subpath and localhost, totaling 45. Screenshots are visually inspected, and the backend confirms proxy drafts were not saved. Published-package acceptance separately verifies final SHAs/checksums rather than inheriting intermediate-package results.

This Chrome 113 exposes VirtualKeyboard on localhost but reports a zero-height keyboard rectangle under its default policy; `overlaysContent` is not enabled. All three actual-device cases therefore exercise the viewport fallback. Nonzero API geometry is covered only by host event regressions, not claimed as device acceptance.

Limits: the HTTP viewport fallback is a bounded heuristic, not a universal OS keyboard-state interface. Arbitrary vendor IMEs, manually shrinking split-screen windows while an editor remains focused, and custom keyboards below the detection threshold are unverified. Physical external keyboards, latest Chrome and physical phones are Not run. ADB text injection requests the software keyboard again and cannot stand in for hardware-keyboard acceptance. Host event tests cover ordinary focus, desktop and zoom boundaries without establishing universal mobile-browser acceptance.
