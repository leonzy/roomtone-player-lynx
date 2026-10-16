# Lyric Backgrounds and Built-in Palettes · songloft-org/songloft#523

## 2026-10-16 · White Background Feedback

Delivery authorization: on 2026-10-16 the user authorized this batch's commits, pushes and a reply to songloft-org/songloft#523. Uncommitted/unposted states below are validation snapshots; Git/GitHub records for the same SHA determine final commits, CI and the comment. No stable tag or Issue closure.

For the [follow-up comment](https://github.com/songloft-org/songloft/issues/523#issuecomment-6210432894), an actual Web build of current `1ad0eaf1cba340d644660f64198fed6b8b6d6d6d` reproduces the white background and unmounted cover with either Increase Contrast or Reduce Transparency enabled. Turning each off in Appearance immediately restores the cover background. With amber and increased contrast, the button is approximately `#774600`, versus the reported screenshot's dominant `#774601`; this strongly matches the path but does not establish the reporter's settings.

Only the bilingual switch descriptions change, explaining the cover-background effect and system accessibility precedence. The policy remains unchanged. Evidence: `/tmp/songloft-523-followup/{browser-results.json,normal.png,reduce.png,contrast.png,reduce-off.png,contrast-off.png}`; final validation objects, commands and results are in `validation.json` in that directory. Copy changes add no regression tests; old-implementation failure checks are inapplicable. Not run: Android/iOS/HarmonyOS devices, outdoor use and the reporter's library. Device cause remains unconfirmed. No commit, push, release or Issue reply.

Validation: Linux amd64 / Node 22.17.1 / pnpm 11.15.1; type checking, all 3,543 tests, both Lynx/Web bundles and Web deployment builds pass. Docker Chrome displays the new descriptions at 390px in Chinese and English with no page exceptions. The first two script attempts clicked Collapse before the player entrance settled and missed it; waiting for entrance completion passes. Failed logs are retained.

## Behavior

Keep Lynx's blurred artwork with independent player background, scrim and foreground tokens. The light scrim ranges from .86 to .94, dark from .82 to .90. Active lyrics, translations, romaji and completed karaoke words adjust the accent against bounds covering every possible artwork color, targeting 7:1; other lyrics target 4.5:1, raised to 7:1 with increased contrast.

Loading, missing and failed covers use a soft theme gradient. URL-keyed load state isolates late events from previous artwork. Increased contrast or reduced transparency unmounts the cover and uses a solid background, retaining Android's stable capture root and `flatten={false}`. No background transition animation was introduced.

Appearance adds Blue, Teal, Forest, Rose, Amber and Violet, supporting light/dark/system themes and stored on the current device as `built_in_palette`. Default Blue retains the existing Apple system blue; the alternatives keep Apple semantic colors. Startup reads have revision protection and rapid choices serialize persistence. A server theme pack takes precedence as a whole, disabling the built-in choices with an explanation; restoring defaults resumes the saved device palette. Navigation SVGs explicitly subscribe to palette and pack changes. Plugin WebViews receive live colors through the existing theme message contract.

## Validation Object

- Repository `songloft-org/songloft-player-lynx`, baseline `4d73b793890494301d44b1a19e9df4dd178429e3`, uncommitted source worktree SHA-256: `2914aa368b8eb1a8be6a5c2fc56895d87b575c2dea6a9d2c482b53af0c28d166`.
- Fingerprint: hash `git diff --binary -- src`, then append sorted untracked `src` paths, NUL, contents, NUL. Excludes documentation and generated artifacts.
- Linux / Node 22.17.1 / pnpm 11.15.1. Temporary Go backend, isolated database and synthetic audio/artwork; no user library.

## Completed Validation

- `pnpm exec tsc -b`, `pnpm run build` for both Lynx/Web bundles and `pnpm run build:web` deployment pass. The universal Android Debug build passes; its packaged `assets/main.lynx.bundle` matches the final JS byte for byte.
- The complete suite after background, palette and theme integration passed 332 files / 3530 tests. Screenshot review then found persistent navigation SVGs did not update with inherited CSS. Both navigation files / 13 tests pass after fixing that subscription. After the final build, `pnpm test --maxWorkers=3` passes all 332 files / 3531 tests (started 2026-10-15 12:14:10 UTC+8).
- Two regressions fail with the isolated original PlayerBackdrop: a scrim while loading and retained artwork under accessibility settings. The rendered-SVG regression fails with the isolated original ShellLayout because it stays blue, then passes after the fix. Tests inspect rendered SVG content instead of treating a color getter as UI evidence.
- Actual Docker Chromium interactions with the final deployed Web app cover four combinations: 390px Chinese and 1200px English, each light/dark. Checks cover artwork changes, missing/404 covers, all six palettes, reload restoration and enabling increased contrast. IndexedDB values, root CSS colors, SVG colors and solid-background state pass, with zero page exceptions. All 48 original screenshots are retained. Blank-region pixels confirm artwork changes, identical missing/failed fallbacks and uniform increased-contrast backgrounds.
- Android API 34 / 1080×1920 / density 440 / arm64 native bridge retains four actual light lyric screenshots and a settings screenshot after tapping Rose. SharedPreferences reads back `built_in_palette=rose`; navigation SVGs recolor too. Background pixels differ between the two covers and match between missing/failed covers. AndroidRuntime/LynxError logs captured after the four lyric checks are empty.
- ReactLynx skill scanning and manual review cover thread boundaries, subscription cleanup, asynchronous state and complete style keys. Final diff/encoding results are in the delivery record.

Android environment limits: the universal APK initially selected x86_64, which lacks the servalsvg library. Explicit arm64 installation still let old Fresco/SoLoader choose an x86_64 image library. The final test uses an external Gradle init script to package only arm64-v8a and clears the isolated emulator app's data, without modifying repository dependencies or Gradle configuration. Test APK SHA-256: `2e3ed3190fec44da50b5067535f7e299ec95ffba9c76e65682ff268c6a0c6e57`; its JS matches the final production bundle. While switching to dark, the emulator host exited with a segmentation fault (139). Native dark acceptance failed, with root cause unconfirmed; it did not pass. Native increased contrast and restart restoration were not completed; corresponding browser scenarios pass.

## Retained Evidence and Limits

Review directory: `/home/hanxi/work/songloft-review/issue-523-lynx-20261015/`. Open `index.html` to browse originals in `screenshots/`; `validation.json` binds source, commands, tests and platform coverage. `flutter-reference/` contains previously validated Flutter screenshots for the same Issue, not this batch's Lynx rendering.

Execution logs remain in `/tmp/songloft-523-lynx/`. The delivery directory copies only sanitized verification records, excluding credentials and raw access logs. It also contains final validation metadata; APK compilation alone is not native rendering acceptance.

Representative originals: [Android light lyrics](../../assets/issue-523/android-light.png) · [Web dark lyrics](../../assets/issue-523/web-dark.png) · [Android Rose palette](../../assets/issue-523/palette.png).

Not run: local iOS/HarmonyOS builds and hardware, actual outdoor sunlight. Numerical contrast and Web cannot accept those experiences. No host API changes in this batch.

On 2026-10-15, the user authorized commits, pushes and a reply to songloft-org/songloft#523. Commit clients before synchronizing their actual parent gitlinks. Working-tree/unpublished states above are validation snapshots; Git and workflows for the same SHA determine final commits, CI and development packages. No stable tag or Issue closure in this batch.
