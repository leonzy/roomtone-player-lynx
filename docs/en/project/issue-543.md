# #543 · Plugin pages rejected by an FN Connect gateway

Target: [songloft-org/songloft#543](https://github.com/songloft-org/songloft/issues/543). On 2026-10-27, Lynx baseline `e1572551b9b6fb584e6a2325ef62e9db103e1283` and parent baseline `af5a4b3873ba72e9918ddf661da87ae563448d36`, each plus this uncommitted worktree. Final source SHA-256 and verification summary: `/tmp/songloft-543/verification.json`. Environment: Linux x86_64, Node 22.17.1, pnpm 11.15.1, Docker Chrome 121.0.6167.85.

## Cause and change

Lynx Web's `web/webview-host.js` adds `credentialless` to every plugin iframe. This creates an ephemeral credential/storage context without existing cookies, even for same-origin pages. Songloft's URL token cannot authenticate a NAS reverse proxy's own session. Flutter plugin iframes do not set this attribute. The defect belongs to the browser plugin host; individual plugins and native clients need no change.

Remove the attribute, retaining attached frames, hide/re-entry behavior, message-source checks and theme/player bridges. Hosts opting into isolation continue to rely on the backend plugin HTML's COEP response header. Unlike the iframe attribute, that header preserves cookies for document navigation and same-origin resources. Upgrade old backends missing the header or disable optional isolation rather than dropping credentials. The parent change only corrects the related comment; headers and APIs are unchanged.

## Verification

- Three new credential-context cases cover root hosting, subpath hosting and a separate backend. Against the old implementation all three fail while the existing 22 pass; all 25 pass after the fix. Logs: `/tmp/songloft-543-negative-unit.log`, `/tmp/songloft-543/unit.log`.
- Docker Chrome gateway fixtures use a synthetic HttpOnly `os-access-code` cookie, a desktop outer iframe, root hosting, a `/songloft` prefix, and an isolated host with a cross-origin plugin. The old script omits the cookie and gets 403 in all three configurations. The fixed script loads the plugin HTML and authenticated resource in all three and restores normal browser storage. Results and server-observed requests: `/tmp/songloft-543/browser-result.json` and `gateway-requests.jsonl`. This models authentication, not access to the reporter's NAS.
- Types, dual Lynx/Web build, `build:web`, embedded Go packaging, all 350 files / 3714 Vitest tests and 89 release-tool tests pass. Logs are under `/tmp/songloft-543/`; existing `touch-action` encoder warnings remain.
- The actual full server uses a temporary database and an uploaded static fixture plugin, behind a cookie-authenticating gateway and inside a desktop-style outer iframe. Browser interaction logs in and clicks the plugin entry. Results, screenshot and backend/gateway requests: `app-browser-summary.json`, `app-browser.png`, `backend.log`, `app-gateway-requests.jsonl`. The initial fixture CSS used a non-static path; it was corrected, and that initial 401 is not counted as successful asset validation.
- Parent: `gofmt -w .` and `CGO_ENABLED=0 go test -tags dev,lite ./internal/jsplugin`; final results are in `verification.json`. A concurrent HLS test change in the parent is outside this batch.

Not run: the reporter's actual FN Connect / mobile app, Firefox, Safari, native builds/devices (Web host only), full backend tests and remote CI. No commit, push, release or Issue comment. The submodule remains dirty without a new gitlink. The reporter's previous version is unknown; no first affected release is established.

The above is a pre-commit validation snapshot. The user subsequently authorized committing, pushing, updating the parent gitlink and replying to the Issue. GitHub delivery records govern final commits, same-SHA CI and the comment; no formal release or Issue closure is authorized. The concurrent parent HLS test fix was independently committed as `f1d57aee1cc851e237b78b4b3e9d2f14c5f40f51` and is preserved.
