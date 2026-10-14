# 歌词页屏幕常亮、退出与缓存 · songloft-org/songloft#520

2026-10-14。最初批次只实现常亮配置；后续退出与缓存修复记录见下方，早期验证对象保留。

## 后续：Android 退出与共享滑块

2026-10-15 完成交付检查；本批调查/实现跨 10 月 14–15 日。

基线 `992eb4930bc686f7160a1ca0bfbab42368dad284` + 未提交工作树。源码 SHA-256 `91081db04d46ca624cef095ea5498c52f81e0c55bb0fbfd7fe75b53519776d9e`（算法/范围见验收 JSON）。

- 设置页 Android「退出应用」和首页第二次返回共用原生 `AppExit`，停止播放器、播放服务和悬浮歌词服务，移除任务并释放进程。Home/普通切后台继续播放；通知 X 仍只停止播放和移除活动通知。登录与偏好保留，下一次打开冷启动。
- Android 宿主在初始/更新 globalProps 上报 `androidExitAppStopsPlayback=true`；旧壳只有 `exitApp` 方法不代表它会停止运行。JS 热更到旧壳时隐藏新退出入口，完整功能需要新 APK；iOS/Web/HarmonyOS 本批不新增显式退出入口。
- 为锁定的 `@lynx-js/lynx-ui-slider@3.135.4` 保留源码与分发代码补丁：松手等待尚未完成的边界测量并提交最后位置；不同手势/卸载拒绝过时回调，非拖动的移动不再启动手势。共享库的修复覆盖缓存、字号、歌词调整和进度控件。
- 实际 Android 测量确认旧填充条宽度为 0；为内部填充条设置完整进度包装层宽度并居中到轨道。两个缓存滑块可在整个轨道上选择，字节值仍在松手时写本机偏好/服务端配置。
- 原生触摸 detail.x 相对 LynxView，而公共 helper 的 relativeTo:'' 在 Android 返回局部 left=0，使可见轨道中点比例变成 0.597。补丁直接使用 boundingClientRect：原生 relativeTo:null、Web relativeTo:'screen'，统一坐标系。
- 进度条点按：首个 onDragging/onValueChange 共用渲染前闭包，忽略初次值使受控同步将静止点按重置到零。现在在开始时填入预览值并消费每次手势位置。旧控件新增 2 项回归均失败、修复后通过；API 34 对 120 秒音频点按 25%/50%/75%，实际进度约 30/60/90 秒且继续播放。证据 `/tmp/songloft-520-progress-wrapper-{negative,fixed}.log`、`/tmp/songloft-520-progress-native-taps.json`。
- Linux / Node 22.17.1 / pnpm 11.15.1：类型检查、最终 Lynx/Web 生产构建、328 文件/3516 项完整测试与 77 项发布工具检查通过。Debug 原生 APK 包含最终 bundle 与退出能力，`assembleDebug` 通过。日志 `/tmp/songloft-520-progress-{types,prod,web,tests,release}-final.log`、`/tmp/songloft-520-progress-native-android.log`；本批工作树标识/APK 哈希与验收清单见 `/tmp/songloft-520-push-validation.json`。
- 同一夹具执行实际分发控制器，修复后 8 项通过，未补丁库 7 项因目标行为失败；旧导航源码不能通过新退出接线检查。证据 `/tmp/songloft-520-coordinate-negative-final.log`、`/tmp/songloft-520-exit-old-native.log`。
- Android API 34 模拟器，1080×1920/density 440，明确 --abi arm64-v8a 与 native bridge（SVG 包无 x86_64 库）：本机缓存左/中/右分别保存 100 MB/2 GB/10 GB，服务端分别保存 100 MB/5 GB/100 GB。通知 X 清掉活动通知与前台服务状态、停止播放并保留应用；设置退出和首页双返回均清空 PID、活动服务、通知，重开保持登录。证据 `/tmp/songloft-520-lynx-{device,server,exit,back-before,back-after,stop-before,stop-after}-final.json`。同一夹具为隔离服务器/数据库与合成音频。
- 测试容器曾因宿主内存不足退出；恢复后完成验收，该次中断不计通过。Not run：鸿蒙 4.2 真机、iOS/HAP 编译及对应触摸行为、实际悬浮歌词已开启时的退出。Android 模拟器与确定性控制器回归不能证明该鸿蒙设备已验收。2026-10-15 用户已授权提交、推送和回复 Issue，本批不打正式版 tag；完整退出能力需要新 APK，旧壳热更只隐藏设置入口，原有双返回仍按旧壳实现。

## 实现与边界

「设置 → 播放设置 → 歌词 → 歌词页屏幕常亮」，位于自动进入歌词选项之后。默认关闭，`player_lyrics_keep_screen_on` 仅保存到本机；旧偏好读取不会覆盖刚修改的开关，快速写入按序保存。

只有当前 `/player`、存在歌曲、布局测量已完成且歌词可见时请求。手机返回封面、进入播放器子路由或卸载时释放；宽屏并列歌词同样生效，暂停不取消查看歌词的常亮。

`SongloftPlatform.setKeepScreenOn(bool)` 为三端原生 fire-and-forget 方法。Android 在主线程设置窗口旗标，系统在后台允许熄屏；iOS 合并请求与 scene 活跃状态，失活和根销毁释放；HarmonyOS 合并 Ability 前台状态，串行写窗口并在销毁/替换时释放。旧壳缺方法安全降级，需要新原生安装包才获得该能力。Web 通过 Worker 桥到主线程 Screen Wake Lock，可见时申请、隐藏时释放/恢复时重获，迟到申请也释放；浏览器拒绝/不支持不影响播放。

## 验证

- 仓库：`songloft-org/songloft-player-lynx`；基线 `a69a45f4c3048171ddbc1f0f33c9922fa3af74d8` + 未提交工作树。源码 SHA-256 `060b520c51d9b841dd8953e5e3925059ed0c968f4d6688bc669bc24da31f4c42`；算法/范围见 `/tmp/songloft-520-validation.json`（源码 diff + 范围内未跟踪路径和内容，不含文档）。
- Linux、Node 22.17.1、pnpm 11.15.1；`pnpm exec tsc -b`、`pnpm run build` 双产物、`pnpm run build:web` 通过。先完成构建后运行 `pnpm test`，324 文件 / 3496 项通过，日志 `/tmp/songloft-520-lynx-{types-final,build-final,web-build-final,tests-final2}.log`。
- `node scripts/copy-bundle-android.mjs` 后，`cd android && ./gradlew --no-daemon assembleDebug` 通过，包含最终 JS 和新宿主方法；日志 `/tmp/songloft-520-lynx-android-final.log`。
- Node 亮屏/Web 异步申请与鸿蒙前后台/窗口替换控制器测试文件通过；ArkTS 测试通过 TypeScript 转译适配器执行真实源码，**不是 ArkTS 编译**。隔离副本移除 Web 迟到申请释放后，测试因预期断言失败；日志 `/tmp/songloft-520-{web-host-tests-final,harmony-host-tests-final,web-negative}.log`。
- Docker `browserless/chrome:latest`，最终 embedded Web，420×900：真实登录、打开播放设置并开启开关，IndexedDB `prefs.player_lyrics_keep_screen_on` 保存 `true`；设置页 `requested/held/pending` 均为 false，证明配置开关不会在设置页直接保持亮屏。截图 `/tmp/songloft-520-lynx-toggle-final.png`，结果 `/tmp/songloft-520-lynx-settings-ui-final.json`。UI 后端/数据库隔离，音频为合成测试数据。
- 格式、差异及 UTF-8 检查通过。Not run：iOS Xcode 编译、HarmonyOS HAP 编译（没有对应工具链）、原生设备熄屏和实际电源策略（无连接设备）；UI/控制器测试不代替这些验收。

上述验证执行于提交前；用户随后授权提交、推送及回复 Issue。客户端先提交，父仓库随后记录实际子模块 SHA；最终提交以 Git 记录为准，推送后的 CI/开发包状态以同一 SHA 的工作流为准。本批不打正式版 tag，现有 v0.1.1 包不包含本批新方法。下载引导须区分 Android APK 与 HarmonyOS NEXT HAP（最低 `5.0.1(13)`），报告人的 4.2 系统不能直接按 NEXT 包适用范围引导。
