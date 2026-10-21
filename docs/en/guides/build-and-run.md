# Build and run

Commands for all four hosts and known toolchain pitfalls. Scripts are defined in package.json.

For a quick preview, see [getting started (Chinese)](../../getting-started.md). For capability differences, see [platform differences (Chinese)](../../architecture/platform-differences.md).

## Requirements

| Tool            | Requirement                                                           |
| --------------- | --------------------------------------------------------------------- |
| Node            | `^20.19.0 \|\| >=22.12.0`                                             |
| Package manager | pnpm; commit pnpm-lock.yaml                                           |
| Backend         | `http://localhost:58091`, initial `admin/admin`, API prefix `/api/v1` |
| Android         | ANDROID_HOME, JAVA_HOME, JDK 17, Android SDK                          |
| iOS             | macOS, Xcode, CocoaPods 1.16.2 (matching Podfile.lock)                |
| HarmonyOS       | DevEco Studio 5.0+ or CLI/hvigor toolchain                            |

```bash
pnpm install
```

The postinstall hook applies the required web-core patch. Do not skip it.

## Shared JS

```bash
pnpm run dev
pnpm run build
pnpm exec tsc -b
pnpm test
```

The build must list both File (lynx) and File (web). Declaring Rspeedy environments replaces the implicit defaults: omitting `lynx: {}` silently stops generating the native bundle. The copy scripts reject bundles older than their source inputs.

Typechecking must use `tsc -b`; plain `tsc --noEmit` does not check this referenced project. Use `-b --force` when necessary to invalidate incremental state.

JS checks do not compile Kotlin/Swift/ArkTS or validate a browser/device. Run each affected host's checks too.

## Android

```bash
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk17
pnpm run android:install
adb reverse tcp:58091 tcp:58091
adb logcat -s lynx:V LynxUISVG:E AndroidRuntime:E
```

`adb reverse` forwards the device's localhost backend connection to your development host. Set JAVA_HOME explicitly. On Homebrew, `/usr/libexec/java_home` may not find an unregistered JDK; check `java -version` and the actual installation path instead.

For compilation without installing a device:

```bash
cd android
./gradlew --no-daemon assembleDebug
```

Machine-specific Homebrew/mise path examples are retained in the [Chinese counterpart](../../guides/build-and-run.md); use your own actual paths.

## iOS

```bash
pnpm run ios:pods
pnpm run ios:build
pnpm run ios:run
```

`ios:pods` ignores the global Git config to avoid a machine's HTTPS→SSH URL rewrite breaking pod clones where port 22 is blocked. A CocoaPods JSON parse error can also indicate a truncated CDN podspec cache; remove that corrupt cached file or use a disposable CP_HOME_DIR.

The local ios:build command uses two legacy project/target builds sharing SYMROOT because the original development machine lacked the required Xcode platform component. Once platforms are installed, prefer the standard workspace/scheme/destination command used by CI. ios:run requires a booted simulator. Its localhost is the host machine, so no adb-reverse equivalent is required.

Xcode 27.1 rejects the iOS 9/10/12 deployment targets declared by some Pods. The app already requires iOS 15; when running the two `xcodebuild` commands manually, pass `IPHONEOS_DEPLOYMENT_TARGET=15.0` to each so dependencies use the same floor. If `xcode-select -p` points to Command Line Tools, check whether `/Applications/Xcode.app` exists; set `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` for the command without changing global settings.

The same environment promotes Lynx 4.0.1's ignored `std::future` results and deprecated UIKit API warnings to errors. This batch additionally passes `'OTHER_CPLUSPLUSFLAGS=$(inherited) -Wno-error=unused-result'` to the Pods build, appends `-Wno-error=deprecated-declarations` to Lynx Objective-C/Objective-C++ files in the temporary generated Pods project, and adds `-Wno-error=deprecated-implementations` only to `LynxTextLayoutManager.m`. Both warnings remain visible; dependency sources, tracked projects and application checks are unchanged. Reproduction scripts/results are linked in [acceptance](../project/feature-port-20261021.md). Record this conditional build separately from default-command failures.

After rebuilding, terminate the running simulator app before installing the new bundle. Installing alone does not replace an existing process; the E2E setup script may also reuse an installed app.

## HarmonyOS

Local builds require DevEco Studio/CLI including hvigor. CI build-and-release.yml installs the toolchain and builds HAPs. A workflow's presence is not evidence that current ArkTS passes compilation; inspect the actual run.

```bash
pnpm run build:harmony-bundle
# After ohpm install, run pnpm run harmony:postinstall
# In DevEco Studio, open harmony/ and Build > Build Hap(s)/APP(s)
```

Linux can also compile with the CI CLI toolchain. On 2026-10-07, CLI `26.0.0.821`, SDK `26.0.0.105` and hvigor `6.26.4` produced an unsigned release HAP in a temporary directory. Download provenance, SHA-256 checks, ArkTS fixes and logs are in [progress (Chinese)](../../project/progress.md). With the toolchain's `bin` on PATH, run these steps in an isolated checkout (`prepare-harmony` rewrites version and signing configuration):

```bash
pnpm run build:harmony-bundle
node scripts/prepare-harmony.mjs
cd harmony
ohpm install
cd ..
bash harmony/scripts/patch-lynx-event-reporter.sh harmony
node scripts/patch-harmony-webview.mjs --required
cd harmony
hvigorw clean assembleHap --mode module -p product=default -p buildMode=release --no-daemon
```

This verification preserves the minimum compatibility declaration `5.0.1(13)`; the newer toolchain determines the package's compile/target SDK. It does not establish API 13 device behavior. The result is `entry-default-unsigned.hap`; signing and device acceptance remain required.

The bundle is copied to entry/src/main/resources/rawfile. Module registration is per LynxView in pages/Index.ets; EntryAbility.ets configures the HTTP service. FloatingLyric and LiveActivity are unavailable and degrade to no-op. Use a HarmonyOS NEXT device/simulator and hdc for behavioral testing.

## iOS widget signing

iOS widget signing: the project includes the `SongloftWidgets` extension. Both app and extension require App Group `group.org.songloft.lynx` entitlements and matching provisioning profiles. The version script synchronizes both targets; project parsing does not replace an Xcode build/signing check. See the [port acceptance record](../project/feature-port-20261021.md).

## Web

```bash
pnpm run web:sync
pnpm run web:dev
pnpm run build:web
pnpm run build:web-embedded
```

web:dev only serves existing output; it does not build. web:sync and build:web produce the same standalone output. build:web-embedded produces a same-origin asset package at the parent repository's clients/player-build/web-embedded path. Verify Web changes by actually opening the newly built product.

The production web-core entry uses import.meta and must load via `<script type="module">`. Loading it as a classic script yields a blank page even when all asset requests succeed.

## Subpath deployment

The host supplies its directory through webBaseUrl before engine startup for API, Worker, asset and plugin-bridge URLs. The parent passes `--embedded --go-embed` to add a `<base href="/">` tag that Go replaces using `-base-path /xxx` or `BASE_PATH=/xxx`. Raw embedded static archives omit it to retain static subdirectory hosting. Redirect `/xxx` to `/xxx/`; navigation uses memory history.

Root and subpath deployments have real isolated-browser coverage. Current core flows over ordinary HTTP do not require SAB or isolation headers; see [Web deployment](web-deployment.md) for coverage limits.

## Related

- [Installation](installation.md) / [Releasing](releasing.md) / [简体中文](../../guides/build-and-run.md)
- [Testing](testing.md), [debugging (Chinese)](../../guides/debugging.md), [Web deployment (Chinese)](../../guides/web-deployment.md), [AGENTS validation rules](../../../AGENTS.md)
