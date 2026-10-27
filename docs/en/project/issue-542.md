# #542 · Web playlist pagination and mouse dragging

Target: [songloft-org/songloft#542](https://github.com/songloft-org/songloft/issues/542). Baseline `81c478c14d67de8a9a9dbbfcc9ab0857e4ee405a` plus the uncommitted worktree on 2026-10-27. Final file fingerprints and verification results: `/tmp/songloft-542-verification.json`. Environment: Linux x86_64, Node 22.17.1, pnpm 11.15.1, Docker Chromium 121.

## Behavior and evidence

- Flutter's `_AppScrollBehavior.dragDevices` in `main.dart` includes mouse. Lynx Web captured sortable handles but did not implement mouse drag scrolling for ordinary lists. The new Web host script scrolls the actual container with the left button, captures after 5px, and suppresses the click following a drag. Ordinary clicks, labeled actions, editors, sortable handles, sliders and touch retain their own interaction paths. Cancellation, blur and removal clean up the gesture.
- While fetching a page, `PlaylistDetailPage` replaced its bottom inset with a shorter loading footer. The old implementation locally alternated between scroll ranges/end positions differing by 32px. Loading now stays inside the same fixed inset, and the footer avoids Web offscreen size estimates. Web uses its supported `lower-threshold-item-count` to prefetch; native retains the pixel threshold.
- Scroll position updates previously invoked `renderItem` again for every loaded song. `VirtualList` now caches unchanged row trees. Playlist rows also use memo when pages are appended, with stable callbacks reading the latest pages/actions through a ref. Existing rows therefore retain up-to-date playback queues. Selection, song objects, order and group initials still invalidate affected rows.
- Against an isolated old implementation, 6 new assertions fail and 23 existing cases pass, covering missing mouse scrolling, host packaging, rebuilding 80 loaded rows, the bottom inset and old rows rerendering on pagination. Log: `/tmp/songloft-542-negative-final.log`. The initial isolated Vite path error is excluded from negative evidence.
- The browser fixture serves 161 synthetic songs with immediate page responses; it neither accesses nor modifies the user's library. A real 320px mouse drag moves the list to offset 320 without leaving the playlist. Paging reaches song 161, menus still open, and there are no page errors. Final logs, screenshots and timing are recorded in the verification summary.

## Validation boundaries

Shared JS, types, dual outputs, Web packaging, full tests and final browser command results: `/tmp/songloft-542-verification.json`. Builds retain the existing `touch-action` encoding warnings.

- `pnpm test --maxWorkers=4`: 350 files / 3711 tests pass, `/tmp/songloft-542-tests-verified.log`. The first full run found a selection contract still pointing to the page before row extraction; after updating its expected component path, the full rerun passes. Original failure: `/tmp/songloft-542-tests-final.log`.
- `pnpm exec tsc -b`, `pnpm run build` (both Lynx/Web outputs), and `pnpm run build:web` pass. Logs: `/tmp/songloft-542-{types-final,build-final,web-final}.log`.
- With the browser idle, eight page appends of up to 20 songs take 309/392/423/464/465/535/558/415ms and reach song 161 without page errors. Raw results, screenshot and driver: `/tmp/songloft-542-browser-idle.json`, its `.png`, and `/tmp/songloft-542-latency.js`. These fixture timings are not a speed guarantee for the reporter's device or a controlled old-version comparison.
- The Web touch-slider regression requests offsets 20…120 when dragged to 80%, settling on song 129 (offset 8192, thumb 20%) without page errors: `/tmp/songloft-542-touch.{json,png}`. This covers Web touch, not native devices.

Stop pagination timing as soon as new rows are appended, then collect screenshots/visible-row evidence separately. Reading every song's bounds forces browser layout; the probe's cost must not be reported as pagination rendering time. Browser measurements made during concurrent full tests are also excluded from performance conclusions.

Not run: the reporter's Chromium 150, actual library and binary deployment; Android/iOS/HarmonyOS host builds and devices (hosts unchanged); remote CI and release. This environment has not reproduced all conditions of the reported complete freeze at 80 songs. The changes address confirmed interaction gaps, repeated updates and height jitter; local fixture success does not establish acceptance in the reported environment. No commit, push or Issue comment.

The above is the local pre-commit validation snapshot. The user subsequently authorized commit, push, parent gitlink update and a reply to #542. GitHub delivery records govern actual commit SHAs, matching CI and comments; formal release and Issue closure remain outside scope.
