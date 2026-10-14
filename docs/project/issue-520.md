# 歌词页屏幕常亮 · songloft-org/songloft#520

2026-10-14。本批只实现常亮配置；退出问题按用户要求暂缓。

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
