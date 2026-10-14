# Lynx Client Development Lessons

## Scope and Sources

Record dual-thread behavior, shared JS, and four platform hosts in songloft-org/songloft-player-lynx. See the [local AI workflow](docs/en/guides/ai-development.md) and parent host constraints. Existing AGENTS/business references remain authoritative; link evidence rather than duplicating incident histories.

## Recording and Promotion

Include rule, scope, full owner/repo#number, failure/fix commit SHAs, actual validation, and Done right examples (pending if unavailable). Seen counts independent events on distinct dates, not repeated reviews. Three dates make promotion candidates; mark the authoritative destination. Existing hard rules/serious failures apply immediately. Synchronize the [Chinese version](LESSONS.md), never invent counts/resolution/device acceptance, and redact sensitive information.

## Entries

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
