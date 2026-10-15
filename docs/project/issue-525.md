# #525：3 万首播放队列实测与修复

关联：[songloft-org/songloft#525](https://github.com/songloft-org/songloft/issues/525)。2026-10-15 先完成基线实测，再按用户追加要求修复 Lynx；以下保留修复前证据。

交付授权（2026-10-15）：用户已授权提交、推送 Flutter/Lynx 修复与父仓库子模块指针，并回复上述 Issue。下文未提交、未推送和 CI 未跑描述属于本地验证阶段快照；最终提交、CI 与开发包状态以 GitHub 同一 SHA 的记录和 Issue 回复为准。不创建正式版 tag，不关闭 Issue。

## 结论

**基线 Web 与 Android 原生模拟器均确认严重卡顿。** 当前工作树改为有界队列窗口，并优化播放状态保存，修复后验证单列于文末。早期 [Lynx #4](https://github.com/songloft-org/songloft-player-lynx/issues/4) 的 500 首修复与本次规模不同。模拟器的绝对耗时不能作为真机性能保证。

## 对象与方法

- Lynx 源码：干净基线 `e924f05a334254b6eb754927b2808f87a7943302`；父仓库 `aedbe1e`，Flutter 修复已在 `bb03a5c` 本地提交，未推送。
- Linux amd64、Node 22.17.1、Docker browserless Chrome，390×900 手机布局。真实 Go 后端及隔离数据库提供 30,000 条合成歌曲、静音 WAV 和 PNG 封面，无私人音频。
- 生产 Web 构建后，通过真实 IndexedDB 恢复完整队列，当前索引为 15,000。使用鼠标进入全屏播放器并点击实际队列按钮。脚本、日志、产物哈希及验证对象保存于 `/tmp/songloft-525-lynx/`，汇总见 `validation.json`。
- 所有 E2E 注入、权限、安装、清除数据与模拟器副本均限定在本次隔离环境；没有修改日常客户端数据或生产数据库。

## Web 结果

| 场景 | 实际结果 |
|---|---|
| 100 首基线 | 队列打开约 307ms；DOM 中存在全部 100 行，总节点 1,216；真实滚动后点击歌曲约 129ms 更新当前曲，真实音频元素继续播放，页面异常为零 |
| 30,000 首、默认设置 | 分步确认恢复完成；打开前 DOM 为 100 个节点；实际队列点击在 2ms 内确认送达，随后等待行出现时 `Runtime.callFunctionOn` 超过 15 秒无响应；队列未完成可操作验证 |
| 30,000 首、关闭歌名滚动偏好 | 点击在 31ms 内确认送达，随后同样超时；未证实关闭该设置可绕过问题 |

首次长运行在观察 231 秒后仍未完成，但该轮未细分点击前后的阶段，不把 231 秒当成精确打开耗时。后续带阶段标记的运行明确确认了点击送达后页面查询超时。Chrome 容器 OOM 计数为零；失败未当作通过，无法完成的 3 万首滚动、切歌与删除也未沿用 100 首结果。

实现核对：`PlaylistDrawer` 使用 `VirtualList`，但共享包装仍对全部 `items.map` 并调用 `renderItem`；每行包含 `ScrollingText`。100 首真实 DOM 也包含离屏行。现有 500 首组件测试 mock 了 `VirtualList`，只证明委托给该组件，不证明 3 万首的真实布局或响应能力。完整性能根因仍待 CPU/渲染追踪，不能仅凭这些线索认定唯一瓶颈。

主要证据：`web-test.log`、`web-results.json`、`web-100-390-open.png`、`web-large-before.png`、`web-large-click.json`、`web-isolated.log`、`web-large-isolated-error.txt`、`web-static.log`、`web-static-error.txt`。早期探针的选择器错误属于测试工具调整，不作为产品失败依据；最终 100 首运行读取真实媒体元素引用。

## Android 与自动检查

- `pnpm run build:web`、`SONGLOFT_TEST_BRIDGE=true pnpm run build:android-bundle`、`./gradlew --no-daemon assembleDebug` 通过；定向队列、加载器和 store 测试 3 文件 / 80 项通过。
- 最终有效环境为干净 Android 34 / x86_64 Google APIs 模拟器，通过 `libndk_translation` 强制运行同一 APK 的 ARM64 库，Xvfb + Mesa llvmpipe，4 核 / 3GiB，320×640。确认安装 ABI、当前 APK 与源码绑定。通过真实登录和 E2E store 准备完整队列，再使用 ADB 真实点击队列按钮；先以截图校准状态栏偏移。通知及电池优化弹窗仅在隔离设备上处理。

| 原生场景 | 实际结果 |
|---|---|
| 100 首 | 打开到首行可测约 1,398ms；点删除后 100→99、当前曲不变；实际滑动后 `scrollY=218`；点下一首更新歌曲，音频继续播放。删除约 1,157ms、下一首状态更新约 734ms，均为本次模拟器样本 |
| 30,000 首 | 打开前 store 确认完整队列、索引 15,000、当前歌曲 `Native queue 15000`。真实点击后首行测量未返回，原生测试桥达到内置 15 秒期限；截图仍停在全屏播放器，未出现队列 |
| 卡顿时媒体状态 | 同一 PID 5586 仍存在；两次 `dumpsys media_session` 均为 `PLAYING(3)` / speed 1.0，同一歌曲 position 24,576→42,651ms。界面未响应与原生媒体继续播放分别取证 |

证据：`native-final-test.log`、`native-results.json`（只含已通过的 100 首）、`native-error.txt`、`android-30000-before.json`、`android-100-{open,scrolled}.png`、`android-30000-pending.png`、`android-30000-media-{pending,after}.txt`、`android-final-logcat.log`。3 万首打开失败后的滚动、删除、下一首未完成，不写为通过，也不把 100 首动作结果外推。

前置环境失败单独保留：Android 34/35 x86 曾出现模拟器退出 139、SVG `renderWithDiagnostics` JNI 缺失；Android 35 / 16KiB 页 ARM64 转译曾在载入队列前出现 ART `Class::FindClassMethod` SIGSEGV，系统启动也出现 `system_server` 崩溃。日志为 `android-logcat.log`、`android-mesa-arm64-logcat.log`、`android-boot-crash.log`，不将这些失败归因于 3 万首队列。

基线阶段 Not run：原生 3 万首打开之后的有效交互验收、iOS/HarmonyOS、真机及私人曲库；前者被已复现的卡顿阻断。此处仅描述修复前范围，修复后的检查另列。

## 修复实现

- `QueueRows` 只创建可见区域及前后各 8 行，两个占位块保留完整滚动范围，不裁掉队列数据；打开时定位当前曲。行高与偏移使用同一尺寸，随大字体扩展，队尾初始偏移钳制到完整视口。
- `savePlaybackState` 按不可变队列引用和存储实例判断是否需要保存歌曲；仅进度/索引更新时不再编码或跨桥发送完整队列。队列变化时每 256 首分批编码并让出事件循环，清空或失败后失效保存标记，继续保留写入顺序。
- 缓存歌曲保留无远程地址的 version-1 快照；索引和进度优先读取独立小键，旧 envelope 仍可回退读取，旧客户端也不会把快照误当成服务器歌曲。
- 新回归直接验证 3 万首的有界挂载、远处行的原索引、队首/队尾与空队列。隔离旧实现的离屏行断言失败；移除队尾钳制时偏移断言失败。另有 3 条持久化回归在旧实现中失败，覆盖重复全量写入、事件循环阻塞和离线进度。
- 源码对象：基线 `e924f05a334254b6eb754927b2808f87a7943302` + 未提交工作树；5 个代码/测试文件的 `git diff HEAD -- <files>` SHA-256 为 `20bad72ed9c269fa3b3cdba02e80b156ab546c57a8bac76f2125002f9ece0d60`。最终复测证据单独保存于 `/tmp/songloft-525-lynx-fix/`，不覆盖基线失败日志。

## 修复后验收（最终工作树）

2026-10-15，沿用隔离 Go 后端、合成 3 万首与 Android 34 / ARM64 转译环境。最终 APK 使用干净应用数据，验证安装包和 APK 内 bundle 哈希；Web 使用关闭测试桥的生产产物。表内耗时为本次环境样本，包含实际点击和可见当前行测量，不能外推为真机基准。

| 场景 | 结果 |
|---|---|
| Web 100 首 / 中文 390px | 334ms 打开；25 行挂载 |
| Web 30,000 首 / 中文 390px | 442ms 打开；25 行挂载；点队尾更新歌曲约 121ms |
| Web 30,000 首 / 英文 1200px | 467ms 打开；26 行挂载 |
| Web 30,000 首 / 中文大字体 | 317ms 打开；24 行挂载；截图核对当前行、标题和删除控件 |
| Android 100 首 | 1,389ms 当前行可见；队尾、删除、上一首/下一首及播放推进均通过 |
| Android 30,000 首 | 1,632ms 当前行可见；实际滑动后范围达 2,039,652px，点最后一首得到索引 29,999；重新打开约 2,272ms，点删除后 29,999 首 / 索引 29,998，前后切歌与音频推进通过 |

- Web 四组均执行实际滚轮、到队尾、选曲、重新打开和删除；确认 IndexedDB 实际保存 99 / 29,999 首及正确播放索引，真实媒体元素继续播放，页面异常为零。
- Android 从实际 SharedPreferences 独立读取到 29,999 首、索引 29,998、末曲 `Native queue 29998`。自动保存期间连续 20 次读取 UI 布局和播放状态，最大响应 35ms，进度 31,350→46,898ms；当前启动周期没有 ANR。原生截图已目测核对。
- `pnpm exec tsc -b --force`、`pnpm test --maxWorkers=4`（332 文件 / **3,543 项**）、`pnpm run build`（Lynx/Web 双产物）、`node scripts/copy-bundle-web.mjs`、Android Debug 构建和 81 项发布检查均通过。ReactLynx 扫描与跨线程人工审查无新增问题；diff、双语、UTF-8 检查通过。
- 证据：`web-final.log` / `web-results.json`、`native-final.log` / `native-results.json`、`native-persistence.json`、`native-heartbeat.json`、`tests-final.log`、`release-tests.log`、`artifacts.sha256`、`validation.json`，均在 `/tmp/songloft-525-lynx-fix/`。最终生产 Web 哈希 `cec5067a7bddb65e395b680aef3a6079d404d277c19d2fca67e0dd8a051389ff`；测试 APK 哈希 `4b5f565fc496f63192098a4b38165385b0418effdd48a7e5eed9d324be90dbfa`。
- 中间版本只有行窗口时仍有全队列进度写入停顿，本次追加持久化修复后重跑全部受影响检查。前置首次启动/旧应用数据及脚本点击时序失败不列为最终通过结果；本次最终测试使用唯一请求 ID 和可见区域断言，避免只测到布局前的离屏行。

Not run：iOS/HarmonyOS 构建与运行、真机、私人音频、长时间后台播放及云端 CI。本次未推送，模拟器结果不替代这些平台验收。

## 交付状态

Lynx 修复位于未提交工作树，未提交、推送、发布或操作 Issue，父仓库 Lynx gitlink 不变。Flutter 的此前授权本地提交为客户端 `bb03a5c`、父仓库 `aedbe1e`。
