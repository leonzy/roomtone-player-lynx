# #532: Built-in favorites cards on home

Tracks [songloft-org/songloft#532](https://github.com/songloft-org/songloft/issues/532), 2026-10-21; [中文](../../project/issue-532.md).

Settings → Appearance → Home layout now includes “Show Favorites on home” and “Show Radio favorites on home”, both enabled by default. Choices are local to each server identity URL and signed-in account, outside server preference synchronization. Only home cards are filtered; library access, favorite functionality, membership and the `hidden` label remain unchanged. The existing radio-section switch controls the entire section while preserving its independent Radio favorites choice.

Identification uses `built_in` and built-in playlist IDs, so ordinary playlists with the same name remain visible. Filtering precedes layout limits. Pagination fills by visible count while retaining raw page-length cursors to prevent empty-page loops. Account switches select separate choices immediately; writes are serialized per account and preserve the sibling switch. Late reads cannot cross accounts. Subscriptions use ReactLynx effects and the store's vanilla API.

Validation object: `songloft-org/songloft-player-lynx@1ef324864b88c679a7b0378eff24cfef3de4f167` plus this worktree, retaining pre-existing feature-port changes. Another build was active in the shared directory, so final builds and tests use `/tmp/songloft-532-implementation/lynx-source`, with separate dependency directories and hard-linked package files. Final fingerprints, commands and results are recorded in `validation.json` in the parent evidence directory.

Logs retain the initial subscription adapter failure, concurrent-worker timeouts and pnpm/dependency path failures in the snapshot. Final results come from `*-final.log` and browser reports; environment failures are not reported as passes. Web screenshots use the real interface and an isolated test database.

- 65 affected home/appearance tests, typechecking and the Lynx/Web dual build passed; the ReactLynx scan reported no issues.
- The broad run passed 344 files / 3661 tests; one theme-catalog file failed while its worker loaded a dependency. A focused retry of that file passed its 3 tests against the same snapshot, completing coverage of 345 files / 3664 tests. Both failure and retry logs are retained.
- Actual Chrome checks passed login, both switches off, filtering on home, persistence after reload, retained library entries, recovery and combinations with the radio-section switch. Real API snapshots confirmed unchanged songs, favorite membership and playlist labels; no page exceptions occurred.
- The existing `progress.md` has no English mirror, so this batch adds a bilingual summary there and keeps full paired records here and in the Chinese version.

Not run: Android/iOS/HarmonyOS native devices; no native host changed. This session authorizes committing, pushing and replying to the Issue. Stable publication remains separate; final commits and CI status are recorded in the follow-up reply and delivery validation record.
