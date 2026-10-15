# 歌词背景与内置配色 · songloft-org/songloft#523

## 行为

保留 Lynx 的模糊封面，使用独立播放器背景、遮罩和文字令牌。浅色遮罩从 .86 到 .94、深色从 .82 到 .90；当前歌词、翻译、罗马音和已唱逐字文字按所有封面颜色的边界调整强调色，目标对比度 7:1，普通歌词 4.5:1。增强对比度时普通歌词也以 7:1 为目标。

封面加载中、缺失或失败时显示主题默认柔和渐变；切换封面以 URL 隔离迟到的旧加载事件。增强对比度或降低透明度时卸载封面、使用纯色背景，保留 Android 模糊采样所需的稳定根节点与 `flatten={false}`。没有增加背景过渡动画。

外观设置新增星蓝、青碧、森绿、玫瑰、琥珀、紫藤六种配色，支持明暗/系统主题，保存在当前设备 `built_in_palette`。默认星蓝保留现有 Apple 系统蓝；其他配色继续使用 Apple 语义颜色体系。启动读取有代次保护，快速点选串行保存。服务器主题包整体优先，激活时禁用内置配色选择并说明原因；恢复默认后重新使用设备保存的配色。底栏 SVG 显式订阅配色和主题包；插件 WebView 沿用既有主题消息契约，实时同步当前配色。

## 验证对象

- 仓库 `songloft-org/songloft-player-lynx`，基线 `4d73b793890494301d44b1a19e9df4dd178429e3`，未提交源码工作树 SHA-256：`2914aa368b8eb1a8be6a5c2fc56895d87b575c2dea6a9d2c482b53af0c28d166`。
- 指纹算法：先哈希 `git diff --binary -- src`，再按名称排序追加未跟踪 `src` 文件的路径、NUL、内容、NUL；不含文档与生成产物。
- Linux / Node 22.17.1 / pnpm 11.15.1；临时 Go 后端、独立数据库、合成音频与封面，不使用用户曲库。

## 已完成验证

- `pnpm exec tsc -b`、`pnpm run build` 的 Lynx/Web 双 bundle、`pnpm run build:web` 部署产物通过。Android 通用 Debug 构建通过，最终 JS 与 APK 内 `assets/main.lynx.bundle` 字节一致。
- 改进背景、配色和主题接入后的完整 332 文件 / 3530 项测试通过；截图自审再发现常驻底栏 SVG 没有随 CSS 自动刷新，修复后 2 文件 / 13 项导航回归通过。最终构建之后执行 `pnpm test --maxWorkers=3`，332 文件 / 3531 项全部通过（2026-10-15 12:14:10 UTC+8 开始）。
- 隔离旧 `PlayerBackdrop` 的两项回归因加载中仍显示遮罩、辅助功能下仍挂载图片而失败；隔离旧 ShellLayout 的实际 SVG 回归因仍显示蓝色而失败，修复后通过。测试读取渲染 SVG 内容，不以颜色 getter 返回值代替界面更新。
- 最终 Web 产物使用 Docker Chromium 实际操作 390px 中文、1200px 英文的浅色/深色四组：切封面、无封面、404 封面、六种配色、重新加载恢复、开启增强对比度。IndexedDB 保存值、根 CSS 颜色、SVG 颜色和纯色模式均断言成功，页面异常为零。48 张原始截图保留；空白区域像素确认封面变化、失败与缺失回退一致、增强对比度均匀纯色。
- Android API 34 / 1080×1920 / density 440 / arm64 native bridge：保留 4 张实际浅色歌词截图及实际点选玫瑰后的设置截图，SharedPreferences 读回 `built_in_palette=rose`，导航 SVG 同步换色。浅色背景像素确认两种封面不同、缺失与失败一致。四张歌词验收后抓取的 AndroidRuntime/LynxError 日志为空。
- ReactLynx 技能扫描与双线程/订阅清理/异步状态/完整样式键自审完成；差异与编码检查以最终交付记录为准。

Android 环境限制：首次通用 APK 默认 x86_64 安装缺少 servalsvg 库；显式 arm64 后旧 Fresco/SoLoader 仍选中 x86_64 图像库。最终用仓库外 Gradle init script 仅筛选 arm64-v8a 打包，清理隔离模拟器应用数据后验收上述浅色画面；不修改项目依赖或 Gradle 配置。原生测试包 SHA-256 `2e3ed3190fec44da50b5067535f7e299ec95ffba9c76e65682ff268c6a0c6e57`，其中 JS 与最终生产 bundle 一致。模拟器宿主在切换深色期间以段错误（退出码 139）退出，对应深色原生验收失败，根因未确认；不是已通过。原生增强对比度与重启恢复未完成，浏览器对应场景通过。

## 保留证据与边界

审核目录：`/home/hanxi/work/songloft-review/issue-523-lynx-20261015/`。`index.html` 可浏览原图，`screenshots/` 保留截图，`validation.json` 绑定源码、命令、测试和平台范围。`flutter-reference/` 是同一 Issue 前一批已验证的 Flutter 截图，不冒充本批 Lynx 渲染。

执行日志在 `/tmp/songloft-523-lynx/`；交付目录只复制脱敏测试记录，不保存登录凭据或原始访问日志。审核目录另附最终验证记录；不把 APK 编译成功当作原生画面验收。

代表性原图：[Android 浅色歌词](../assets/issue-523/android-light.png) · [Web 深色歌词](../assets/issue-523/web-dark.png) · [Android 玫瑰配色](../assets/issue-523/palette.png)。

Not run：iOS/HarmonyOS 本地构建与真机、真实户外强光体验；数值对比度和 Web 不能代替这些平台体验。本批未改动宿主接口。

2026-10-15 用户已授权提交、推送和回复 songloft-org/songloft#523；客户端先提交，父仓库同步实际指针。上述工作树和未发布状态为验证阶段快照，最终提交、CI 与开发包状态以 Git/同一 SHA 的工作流为准。本批不打正式版 tag，不关闭 Issue。
