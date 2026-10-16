# Android Chrome：软键盘与底部导航回归

2026-10-16，用户反馈完整版 Lynx Web 输入一个字母后软键盘消失，底部胶囊导航落到屏幕下面。对应 [English](../en/project/web-android-input-viewport.md)。

## 验证对象

- 父仓库基线 `eebd27d84577ca2de037b6b7db176b13d48c91c6`，Lynx 基线 `209f6c88b071c187064194a2ae197e48c23fa6c3`。先用已发布 dev 的实际 Linux 完整版复现，再测试本批源码工作树构建。
- 隔离 Android 34 / x86_64 模拟器，432×960、160dpi、Chrome `113.0.5672.136`、Gboard。单字输入真实点击 Gboard A 键，连续输入走 ADB；中文组合由 Chrome `Input.imeSetComposition` / `Input.insertText` 驱动，光标回写用 DOM range-edit 事件检查。CDP 读取 DOM/组合事件/媒体状态，`dumpsys input_method` 独立确认键盘显示状态；不是桌面 Chrome 的手机尺寸模拟。
- 后端使用临时数据库和三首合成 MP3/LRC。证据、命令、截图、源码指纹及最终结果保存在 `/home/hanxi/work/songloft-review/android-web-input-20261016/`，验收对象由该目录的 `validation.json` 标识。

## 已复现根因

1. `lynx-ui-input@3.135.4` 的受控 `Input` / `TextArea` 在主线程收到每次输入时，把元素设为 `readonly`，等后台回调后再解除。Android Chrome 会因此撤销 IME 连接。基线 `admin → admina` 的短暂只读变化约 9.5ms，DOM 焦点仍在输入框，系统 `mInputShown` 却从 true 变为 false。
2. `web/index.html` 的 `lynx-view` 使用 `100vh`，在地址栏展开时仍包含其收起后腾出的高度。基线实际可视区域 856px，Lynx 根高 912px，导航下沿 904px，超出可视区域 48px。web-core 的 containment 使 fixed 导航以这个过高的宿主盒子定位。
3. 只停用 Web 的只读锁仍不足：快速输入时，后台较早的 value effect 会覆盖浏览器已输入的新字符。第一版在真实连续字母输入中丢失 `l`，另加四项执行真实控制器的异步回写回归，第一版全部失败。

## 修复

- 用 pnpm 补丁同时维护 `Input` / `TextArea` 的源码与发行 JSX。通过 `SystemInfo.platform` 在 Worker 中识别 Web；Web 不切换临时只读状态，原生与未知平台保留受控锁。
- Web 后台按顺序记录已收到的输入值，在 value effect 中确认并跳过这些浏览器已经应用的回写，避免旧渲染回写破坏新字符、光标或组合输入。初值与不同于输入回写的外部更新继续调用 `setValue`。
- 仅在 Web 宿主 HTML 中增加 `100dvh`（保留 `100vh` 回退），并用 `interactive-widget=resizes-content` 让 Android Chrome 在 IME 显示时调整布局视口。没有修改共享原生布局的底栏偏移。
- 锁文件仅新增输入组件补丁，保留其余依赖版本。依据：[Chrome 官方视口说明](https://developer.chrome.com/blog/viewport-resize-behavior)。

## 验收与边界

验证命令、源码/产物哈希、根路径与子路径的实际 Android 结果及截图见证据目录。新单测分别执行安装后的源码和发行控制器，覆盖 Web/原生锁、组合事件、延迟与批量回写、重复值和外部重置；基线初版有 9 项失败，异步回写缺陷另有 4 项失败。

本地最终结果：3580 项 Vitest、类型检查、Lynx/Web 双 bundle、Go 嵌入构建与 87 项发布检查通过。Android 上 localhost 根路径、局域网 HTTP 根路径、`/songloft/` 子路径各通过 8 项实际交互；另外 4 项覆盖多行输入、真实横屏、恢复竖屏与 360×800 显示尺寸，共 28 项。实际媒体时间推进、系统键盘状态和 DOM 几何分别断言，截图已目测；代理设置只编辑草稿，没有保存测试地址。

Not run：Android 真机、更新版本 Chrome、真实拼音输入法候选词流程、真实 Safari/Firefox、iOS/HarmonyOS 原生宿主运行。模拟器版本与平台边界不能用桌面无头浏览器结果替代；最终提交、推送和 CI 状态按交付记录判断。
