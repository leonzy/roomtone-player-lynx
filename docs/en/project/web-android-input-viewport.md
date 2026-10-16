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
