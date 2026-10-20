# #531 Live radio reconnects

2026-10-20, linked to [songloft-org/songloft#531](https://github.com/songloft-org/songloft/issues/531). Lynx baseline: `f3f78b3aae6e74323b963a9e8c940bf74b3613b5`. Git/GitHub delivery determines final commits and CI status; this record describes the validated pre-commit tree. The user authorized fixing both Flutter and Lynx, committing, pushing and replying to the Issue.

## Cause and behavior

The previous player treated live completed events as song completion and advanced according to playback mode. Errors exhausted three retries before advancing too. Live streams now retry after 1, 3, 9 and 10 seconds, keeping the 10-second cap indefinitely and reconnecting to the current station's live edge. Disconnects preserve priority-next entries and song-count sleep timers. Finite tracks keep their existing bounded retry policy.

Hosts also emit paused during buffering, so that event cannot establish user pause intent. Android MediaSession, iOS MPRemoteCommandCenter, HarmonyOS AVSession and Web MediaSession now emit explicit `play` / `pause` remoteCommand events: the host acts immediately and JS updates live playback intent. Pause, stop, queue clearing, station changes, reset and timed stop cancel retries and pending loads. Play resumes the current station. Actual media-key testing also exposed Android system STOP bypassing the notification's custom exit command while JS kept retrying; ForwardingPlayer.stop now stops the engine and emits remoteCommand too.

System media controls require the matching new native host; replacing only JS cannot add play/pause intent events to an old shell.

`docs/reference/native-modules.md` and `docs/project/progress.md` are legacy Chinese-only files. This change updates the command table and progress without translating the entire historical files; this paired record and the English handoff document the new behavior and event contract in English. See [Chinese](../../project/issue-531.md).

## Validated object and evidence

Evidence: `/tmp/songloft-531-lynx-20261020/`. An isolated database and synthetic live MP3 replace any private music library. Final source diff (`git diff --binary -- src android ios harmony web scripts`) SHA-256: `d953d8a779ac407ae6ecc1473179da53ba5676219acecbc481f723835f2576ca`; final Debug APK: `d8fa380e542f506815018aa7a2e56eca16b4ef903ad0f321f40f6d03b605fc0d`. Temporary backend: 58341; upstream: 58342; Web preview: 38341.

| Check | Actual result |
|---|---|
| `pnpm exec tsc -b` | Passed |
| `pnpm run build`, `pnpm run build:web` | Both Lynx/Web outputs and deployed Web output passed |
| `pnpm test` | 336 files, 3630 tests passed |
| `pnpm run test:release` | 87 passed |
| Isolated old store with new regressions | 12 failed, 4 passed, plus an unhandled offline exception in the old implementation; playback modes, budget exhaustion and cancellation detect the original defect |
| Actual HarmonyOS module source adapters | 6 passed; does not establish HAP compilation or device acceptance |
| Swift 6.2 `-frontend -parse` | Syntax passed; does not establish Apple SDK compilation |
| `node --check web/audio-host.js` | Passed |
| Android Debug bundle + `./gradlew --no-daemon assembleDebug` | Passed |

Final Android APK: Emulator 35.6.11 / API 34 / Mesa llvmpipe with Reduce Transparency. After 50 seconds offline, actual MP3 playback retains station A and both queue entries. Recovery advances 11659→15187ms. System `cmd media_session dispatch` pause/play/stop passes: pausing prevents new requests for 12 seconds online; play resumes progress; STOP clears the queue and prevents requests for 11 seconds online. Final result: `android-result.json`; screenshot: `android-playing.png`.

Intermediate failures remain recorded: The first 110-second outage retained A, but the upstream fixture exited. Restarting it restored progress 32599→36109ms and pause/resume passed; the initial uncancelled STOP prompted the fix above. One new-APK `input keyevent` pause had no effect; directly dispatching through the system media service passes the complete sequence. Key injection does not prove command delivery. Preserve all original logs. Existing next-track Range prefetch code, synthetic MP3 finite duration and actual media-source snapshots support the inference that upstream B requests are prefetches; Worker prefetch request headers were not separately captured. Actual current sources/media-session/queue retain A. HTTP requests alone do not establish a station change.

The final production Web output was opened in actual Docker headless Chrome 121 and radio playback started through UI clicks. A 30-second outage keeps retrying A. After recovery, real progress advances from 0 to 2.37 seconds. Media pause prevents requests for 11 seconds online; system play resumes progress 4.44→6.94 seconds. Every Audio element retains A. Result: `web-final-result.json`; screenshot: `web-final.png`. First-run 110-second media-source snapshots and the statistics-script failure remain in `web-initial-result.json`; they do not establish complete media-control acceptance.

After Debug bridge testing, production Lynx/Web and deployed Web outputs were rebuilt. Final 87 release checks and 420 affected regressions pass. Only Android STOP wiring was added after the full 3630 tests and type checks; affected native contracts, Gradle and device scenarios were rerun on the final source. Validation manifest and final worktree object: `validation.json`, `worktree-final.json`.

Not run: reporter's Android hardware, real unstable networks/long background sessions, iOS devices and local Apple SDK compilation, local HarmonyOS HAP/devices, DLNA live reconnects. Linux cannot substitute for Apple tooling; track same-SHA HarmonyOS CI after pushing. Existing emulator/default-effects rendering limits remain separate; audio assertions do not establish full visual acceptance. No stable release tag or Issue closure.
