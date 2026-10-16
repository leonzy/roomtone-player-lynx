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

## 后续：键盘弹出时收起悬浮胶囊

用户继续反馈键盘弹出时胶囊 tab 被顶到上方。父仓库 `a1d01de31d93ecabe908b73d0740576a9f57a753`、Lynx `e69cef902afd57661301fc76642bb8980273811e` 的已发布 dev 实际复现：可视高度从 856px 缩到 544px，导航下沿从 848px 移到 536px；导航仍可点击。上批将「跟随缩小视口」作为验收项，漏掉了输入时导航不应悬浮在键盘上方的要求。

`viewport-keyboard-host.js` 在浏览器主线程观察实际输入焦点、键盘几何（可用时）和视口变化。局域网 HTTP 没有专用键盘 API，使用触摸能力、输入焦点和显著高度缩减共同判断；按宽度保存视口基准，旋转时参考屏幕高度与浏览器栏占用。缩放按比例归一化，普通聚焦、小幅地址栏伸缩、无编辑器的窗口变化均不能触发隐藏。焦点切换期间保持隐藏，等键盘占用消失后恢复；不修改浏览器的键盘覆盖策略。

宿主只在自己的 Lynx shadow root 注入样式，隐藏底部导航和窄屏悬浮迷你播放器，同时移除命中区与无障碍子树。组件和音频不卸载；键盘收起后保留 tab 选中与播放状态。继续使用 `100dvh` 和 `resizes-content`，保留已修好的连续输入与光标回写。

本批证据、旧版失败断言、最终工作树指纹、构建与设备结果在 `/home/hanxi/work/songloft-review/android-web-keyboard-nav-20261016/`。真实设备脚本检查系统 IME、隐藏后的零尺寸/不可命中、旋转后返回竖屏、按返回键收起后恢复、库搜索时两层胶囊隐藏及媒体时间继续推进；代理测试只编辑草稿。最终通过项、提交与 dev 产物由该目录 `validation.json` 和交付记录标识。

旋转期间实测 IME 有时保持显示，有时收起；不能把「IME 必须始终开启」当作本次导航修复的要求。脚本等待视口和系统状态一致且稳定后，分别断言隐藏/恢复，再实际点击输入框重开键盘并检查隐藏。

最终本地验证：3593 项 Vitest（含 12 项新宿主回归）、类型检查、双 bundle、standalone Web/Go 嵌入构建和 87 项发布检查通过。最终嵌入包在 Android 的 LAN 根路径、`/songloft/` 子路径、localhost 各通过 15 项，共 45 项；截图已目测，后端确认代理草稿未保存。发布包另按最终 SHA/校验和验收，不把中间版本结果代入。

本机 Chrome 113 在 localhost 暴露 VirtualKeyboard API，但默认键盘矩形高度始终为 0；没有启用 `overlaysContent`。三组实际设备检测均走视口回退；非零 API 几何分支只由宿主事件回归验证，不能冒充设备验收。

边界：HTTP 下的视口回退是受控启发式，不是通用的系统键盘状态接口；未验证任意厂商输入法、分屏中持续聚焦时的手动缩窗或低于阈值的定制小键盘。真实外接键盘、最新 Chrome 与真机 Not run；ADB 文本注入会重新请求软键盘，不能充当外接键盘验收。普通聚焦/桌面/缩放等边界由宿主事件用例验证，不能外推为所有移动浏览器均已验收。
