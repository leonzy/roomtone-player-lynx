# Lynx Client Development Lessons

## Scope and Sources

Record dual-thread behavior, shared JS, and four platform hosts in songloft-org/songloft-player-lynx. See the [local AI workflow](docs/en/guides/ai-development.md) and parent host constraints. Existing AGENTS/business references remain authoritative; link evidence rather than duplicating incident histories.

## Recording and Promotion

Include rule, scope, full owner/repo#number, failure/fix commit SHAs, actual validation, and Done right examples (pending if unavailable). Seen counts independent events on distinct dates, not repeated reviews. Three dates make promotion candidates; mark the authoritative destination. Existing hard rules/serious failures apply immediately. Synchronize the [Chinese version](LESSONS.md), never invent counts/resolution/device acceptance, and redact sensitive information.

## Entries

### API-001: Validate Upgrade Payloads Against the Backend Channel Contract

- Scope: Lynx backend update checks, start requests, and page tests.
- Rule: A write mock returning 200 for any body cannot prove an upgrade action works. Check the running channel, its version/notes, and actual POST JSON. Online upgrades stay on the current stable/dev channel; non-Docker deployments have no action.
- Failure evidence: [songloft-org/songloft-player-lynx#11](https://github.com/songloft-org/songloft-player-lynx/issues/11) screenshot and baseline [`0651222`](https://github.com/songloft-org/songloft-player-lynx/commit/0651222b87b5a97daebef7e48c5d497c32a7e71a): the widget sent `{}`, rejected by the backend for missing `version_type`; the old mock did not inspect the payload.
- Fix evidence: source worktree `faec7a428a9675dc1d3e5c98191d963555b8616c409e93658daae6f651e8389b`; five regressions fail with the isolated old widget, the final 36 related tests pass, and browser records confirm dev/stable payloads and rejection/retry. See [progress](docs/project/progress.md). Actual binary replacement and Android devices remain untested; the Git commit containing this entry records the fix.
- Done right: `SettingsApi.startUpgrade(channel)` sends `{version_type: channel}`. About tests use the real API class, transport tests inspect JSON, and browser fixtures reject the wrong channel and record requests, beyond button-presence checks.
- Seen **1×**: 2026-10-14. Existing API rules apply; the three-date promotion threshold has not been met.
