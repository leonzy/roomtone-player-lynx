# Flutter 功能移植验收（2026-10-21）

[English](../en/project/feature-port-20261021.md)

交付授权更新（2026-10-21）：用户审核截图后明确要求「提交推送」，授权本批功能移植直接提交子仓库 main、更新父仓库指针并推送。其他任务的首页收藏/Flutter 改动保持未提交；下文「未提交/推送」描述是各阶段的历史快照。必要 CI 按最终提交 SHA 跟踪，正式发版与 Issue 写操作不在本次授权内。

范围仅包含用户指定的五项优先补齐功能，以及 MV 字幕、Web 真正全屏、平滑逐字歌词、手机桌面小组件。未授权提交、推送或发布；不扩展桌面壳、Bundle、Android Auto 等功能。

## 实现

| 功能 | 行为 |
|---|---|
| 偏好同步 | 登录拉取业务端点 `/settings/user-preferences`，同步主题、播放模式、歌单视图、音质、缓存上限和音量；全默认服务端以本机设置初始化，后续修改防抖串行保存。登录/服务器切换取消过期响应与待写入，初次读取失败不发送默认值覆盖；修改或恢复前台时重试。沿用后端现有服务器配置语义，不引入新的账号级存储。 |
| 永久排序 | 歌单菜单提供名称升降序、数字前缀和随机打乱，二次确认后调用服务器排序，刷新歌曲和歌单缓存；与本机浏览排序分开。 |
| 迷你播放器 | 设置 → 播放设置：仅播放/暂停、上下首、上下首加播放模式三种本机布局；即时更新并持久化。 |
| 删除选项 | 删除本地歌曲可显式选择删除文件；删除歌单可选择删除仅属于这些歌单的歌曲。默认关闭，每次更换目标重置；单纯移出歌单不显示文件选项。 |
| 快捷键 | Web 可录入八项组合键、检查冲突及恢复默认；包括快进/快退与静音。本机保存；保护输入框、IME、浏览器保留键及覆盖层。 |
| MV 字幕 | 当前同步歌词及译文独立于控制栏显示，支持逐字效果与本机字幕开关；退出继续复用原有播放器。Android/iOS/HarmonyOS 的视频表面统一消费共享页面。 |
| Web 全屏 | 请求包含视频、歌词、控件的 document root 全屏；缺少浏览器激活时提供真实点击重试，Escape 状态同步，退出视频清理自有全屏及过期请求。 |
| 逐字歌词 | 仅活动行约 30Hz 推算播放时钟，跟随速度、seek、暂停/缓冲和音轨变化；停滞外推最多一秒，后台及卸载停止帧循环，尊重减少动态效果。 |
| 桌面小组件 | Android 原生 RemoteViews（可调整大小）显示歌曲、封面、上下首、播放/暂停及收藏，动作复用当前队列。iOS 增加 WidgetKit 小/中尺寸扩展和 deep link；点控制项打开应用执行。快照变更驱动更新，不随播放进度写盘；共享快照不保存封面认证 URL，只保存本地缩略图。 |

## 新增可选宿主契约

- Android/iOS `SongloftPlatform.updateHomeWidget(json: string): void` 接收 `hasSong/title/artist/coverUrl/isPlaying/isFavorite/canNext/canPrev`；`consumeWidgetAction(callback)` 在 JS listener 注册后返回并消费冷启动动作。`SongloftWidget.action` 事件载荷为 `[{action}]`，动作限定为 `open/toggle/previous/next/favorite`。旧壳缺方法时跳过；HarmonyOS/Web 本批不实现桌面小组件。
- Web `SongloftVideo.fullscreenState(json, callback)` / `setFullscreen(json, callback)` 返回 JSON `{supported, active, needsGesture?}`；`SongloftVideo.fullscreenChanged` 发 `[{supported, active}]`。原有视频 facade 的必需方法不变。
- 四端新增可选 `SongloftLifecycle.paused`；共享歌词同时订阅既有 `resumed`，随卸载清理。旧壳仍沿用原行为。
- iOS app 与 extension 使用同一 App Group `group.org.songloft.lynx`。实际签名须同时为两个 bundle ID 配置该组；Linux 上解析工程不代替 Xcode 编译或签名验证。

## 验证对象与证据

基线 `1ef324864b88c679a7b0378eff24cfef3de4f167` 的未提交工作树；最终文件指纹、命令日志和截图清单保存在 `/home/hanxi/work/songloft-review/lynx-features-20261021/`，开发中间证据在 `/tmp/lynx-features-20261021/`。测试媒体由 ffmpeg 生成，数据库与账号均为隔离夹具，无私人曲库。

首轮全量 3640 项中 3639 项通过，文本裁剪闸门发现新增歌词/字幕 CSS 缺失 `overflow: hidden`，已修正并补验。新增时钟、歌词组件、全屏拒绝/迟到回调、小组件状态及动作测试用于验证行为，不将源码子串检查计为原生编译。

浏览器实际点按验证迷你布局、录入 `Shift + P`、数字前缀永久排序、删除选项、MV 字幕、全屏及控制栏隐藏。全屏时 `document.fullscreenElement === document.documentElement`，视频 `paused=false`、播放时间持续前进；五次 120ms 采样显示同一词连续变色。服务器读取确认永久顺序为「01 晨光、02 星河 MV、10 远山」和音质 `320` 已保存。

Android API 34 / Emulator 35.6.11 / Mesa llvmpipe，开启减少透明度：实际从系统 Widgets 选择器添加小组件，后台点暂停保持同一位置，下一首改变实际歌曲，收藏写入服务端且桌面心形更新。截图来自真实 RemoteViews。初次 Emulator 37.2.12 尝试分别发生 OOM（137）和宿主段错误（139），不能计为通过；稳定环境的结果不覆盖默认玻璃效果或真机。

最终检查：`pnpm exec tsc -b`、Lynx/Web 生产双产物、`pnpm run build:web`、342 个文件的 3653 项测试、89 项发布工具检查、Android `assembleDebug` 和 `git diff --check` 均通过。修正新增测试夹具参数类型后补跑歌单页面与原生契约共 334 项通过；HarmonyOS 生命周期新增 paused 事件的旧计数断言已更新为完整事件序列，重复后台通知也有覆盖。APK 与源码指纹见证据目录的 `validation.json`，14 张截图见 `review.html`。

补充实际浏览器验证：独立会话拉取 320 kbps；刷新后保留迷你布局及 `Shift + P`。删除文件选项默认关闭，打开后取消再进入恢复关闭；勾选并确认后，隔离数据库中的歌曲和生成的 `99-delete-test.mp3` 均已删除。未触碰私人音频。

最终自审将多选删除接到现有 `/playlists/batch-delete`，一次传入全部选中 ID 和 `delete_songs`。改后重跑类型、双产物、歌单相关 124 项及 89 项发布检查均通过；浏览器实际选中两个测试歌单并勾选清理，后端仅一次批量调用，两歌单和独占的测试歌曲均返回 404，仍属于收藏的歌曲保留 200。共享实现最终变更范围为歌单批量删除；此前 3653 项全量与最后 124 项受影响复验分开记录。

最终 Android 安装包 SHA-256：`d8dc8b7c79a77024d33d2471dc5aa781091b59cf5bc11c524cf4a5c898a9807d`。六项设备断言通过，包含安装包与本地 APK 一致、真实播放进度、暂停稳定、下一首、收藏写入与快照不含认证 URL。此包用于小组件验收，早于最后的共享歌单批量接口调整；小组件相关源码未再变化。

## 同日追加原生验证

用户审核后继续补验；证据另存 `/home/hanxi/work/songloft-review/lynx-native-followup-20261021/`，不覆盖前述截图与 APK 快照。修正 iOS 冷启动动作回调为标量字符串，并让新进程首次快照清除上次会话的封面，即使本次歌曲没有封面 URL。新增回调契约检查在旧签名下失败，修正后原生契约与小组件共 319 项通过；类型、生产双产物和 89 项发布工具检查再次通过。

通过现有 `mac` SSH 别名，在独立临时副本使用 Xcode 27.1（27A9275）/ iOS Simulator SDK 27.1 / arm64。`xcodebuild -list`、格式化后的 `SongloftWidgets`、Pods aggregate 和主应用编译/链接均通过，`ValidateEmbeddedBinary` 确认扩展已嵌入。没有改全局 Xcode 选择、用户工作副本或依赖版本。默认构建先被 Pods 的 iOS 9/10/12 部署目标拒绝；指定既有 iOS 15 最低版本后，Lynx 4.0.1 又触发忽略 `std::future` 返回值和旧 UIKit API 的警告转错误。通过结果使用 [构建指南](../guides/build-and-run.md#ios) 的局部兼容参数：保留两类警告，并为 `LynxTextLayoutManager.m` 单独保留 `deprecated-implementations` 警告；不将默认命令的失败写成通过。复现脚本 `build-ios.sh`、`pod-warning.rb` 和各次日志保存在追加证据目录。七项远端 Swift/资源摘要与本地工作树一致，见 `ios-source-sha256.txt`。仅构建 arm64 模拟器 app，`CODE_SIGNING_ALLOWED=NO`，不当作真机 IPA。

HarmonyOS 使用与现有 CI 一致的 CLI `26.0.0.821` / SDK `26.0.0.105` / hvigor `6.26.4`，两分片及合并包 SHA-256 校验通过；合并摘要 `0cbdf7ac5c1be1e42694d448ffaee0c0be0ba9a948197e2bc5b61ca5bdc481f2`。使用第三方 CI 镜像与下载代理，不声称验证了官方分发签名。独立副本安装原锁定的 10 个包，运行既有两项 SDK 补丁，clean release HAP 构建 34 个任务全部执行成功（18.431 秒）。原包校验器和独立 ZIP 检查确认版本、原生库、生产 JS、bundle 字节及宿主契约；首次误用旧 `.build/native-host.json` 的校验失败单独留档，改用本次构建输入并核对源码契约后通过，未修改校验器。

未签名 HAP 摘要 `6e4a1edf33db3bbcde293a9e67566450981e1aeec5841c87e159ae2ddc624556`，`buildMode=release/debug=false`，compile SDK `26.0.0.105`、target API `260000026`、最低 API `50001013`。这只证明构建与包内容，不代表可安装或设备行为。

同一份当前 JS 重新构建 Android Debug APK，统一版本号 `214722247/dev`，SHA-256 `5b3e9f9eeca4e7283992777757d546f75d726cebc0ec12ac6e3dbd5fd83e70b8`。aapt2 与 ZIP 检查确认版本、实际 bundle、宿主契约和生产 JS 无 E2E 标记；原生 Debug 桥仍存在，不作为生产 APK。新包包含最后的歌单批量接口调整，但尚未重跑设备操作；前述桌面截图及六项实测仍绑定旧 `d8dc8b7c…a9807d` APK，不能移用成新包设备验收。

**Not run**：iOS 签名、模拟器/真机运行及小组件截图（Mac 无已安装运行时或连接设备）；HarmonyOS 签名及设备行为；真机、iOS 浏览器全屏、长时间后台及默认玻璃效果验收。原有 14 张 Web/Android 截图保持可审核。

## 同日 Android 新包实测与 MV 补修

继续验收发现新 APK 在恢复暂停队列、尚未首次加载音频时，桌面播放动作会丢失：小组件借用了尚未就绪的音频 sink。改为独立的 LynxView 动作通道，以 JS 消费冷启动动作为就绪边界；页面替换/销毁只解绑自己的通道。新增 4 项实际 JUnit 和接线回归，接线回归在旧实现下失败。Android 首次无封面快照也清理上次进程的封面，与 iOS 行为一致。

中间包 `86b5c0c87c8889af91ee40be966fae0039f6c04d195cd4601721a99ff40c093e` 在 Android 34 / Emulator 35.6.11 / Mesa llvmpipe / 减少透明度下通过 9 项实际检查。由桌面点击触发，无 JS E2E 钩子；读取原生播放位置证明播放推进和暂停稳定，服务端读取证明收藏写入并恢复夹具。结束应用进程后，下一首触发新进程并在队列恢复后执行；新进程首次无封面快照删除植入的旧缩略图。快照不含服务端 URL 或凭证。证据单独保存到 `/home/hanxi/work/songloft-review/lynx-current-device-20261021/`，保留该中间包、`device-result-86b5c0c8.json` 以及失败尝试，不覆盖此前两批证据。

从真实歌单进入 MV，中文逐字字幕和英文译文实际显示。旧手工测试队列缺少 `lyricUrl`，不将其字幕缺失误判为产品问题。继续播放发现结束后切音频时，原生表面关闭而视频控制页未退出；新增两个已挂载回归在旧实现下均失败，修复后通过。视频页现在随打开时的歌曲引用变化只请求一次父路由导航；保留既有视频、计时器和浏览器全屏清理。普通进度更新不退出视频页。

设备测试注意：系统首次后台运行询问已在隔离模拟器中实际点允许；杀进程后等待系统清理死接收器再点击。暂停后恢复意图字段不能证明实时播放，改用原生位置变化。即时桌面截图有局部按钮未绘制，重新进入桌面后恢复；原图与停稳图均保留，不能据此宣称该软件渲染环境视觉全部通过。默认玻璃及真机仍待验收。

并发任务隔离：本次验收期间，另一任务在共享工作树加入首页收藏显示功能并运行构建。共享目录全量结果为 341 个文件通过、3 个文件失败（3653 项通过、7 项失败；两文件在新增首页收藏 hook 处报 React renderer 错误，另一文件在测试环境 bootstrap fetch 超时）。同时 APK 包内容闸门拦下宿主元数据与 JS 清单不一致的中间包 `4868c663…06595e9`，未将其作为最终通过包。保留上述日志，不修补或覆盖其他任务的改动。

最终验证转到 `/tmp/lynx-current-device-20261021/source`：从基线 Git 归档覆盖本批既有 91 个文件及新增 3 个文件，共 94 个改动路径；不引入其他任务的新文件。仅在隔离副本移除共享翻译中的 8 行首页收藏文案，SHA-256 确认该翻译文件精确恢复到本批上一轮指纹。原始共享翻译和首页改动均保留。复用现有锁定依赖；pnpm 在 symlink node_modules 下试图自动安装并因无 TTY 中止，改用同一依赖中的 Node CLI 直接执行 Rspeedy、tsc 与 Vitest。最终结果、源码指纹和实际安装包摘要以新证据目录为准；先前原生 iOS/HarmonyOS 编译仍绑定上一轮 JS 包，不冒充此次视频页补修后的设备验收。

最终独立副本的类型、Lynx/Web 双产物、Web 打包、421 项相关回归、89 项发布工具检查及 Android 4 项 JUnit/43 任务构建均通过。依赖改为本地硬链接副本，测试缓存另存，避免 symlink bootstrap 阻塞；保留中止尝试。完整重跑受内存争用影响中止，不将其计为新一轮全量通过；本轮以相关复验补充此前 3653 项全量。1833 个未改动基线文件逐一校验 Git blob，确认隔离未混入其他任务。

最终 Android Debug APK 为 `214728490/dev`，SHA-256 `4f0f587080c2efbe34957fc8ffe74ef78f384b9a31bfe66e9dc1652854c76ba1`。实际安装摘要与交付包一致，9 项桌面检查全部通过：原生位置 `50422→53268ms`，暂停 3.5 秒保持 `53268ms`，切歌/收藏及进程 `2761→4299` 后冷启动下一首均成功。请求 guest RAM 1536MiB，但 Emulator 实际提升到 2048MiB；最终容器上限 4GiB，原始结果与环境修正均保留。首轮最终模拟器在应用安装前退出 139，重试成功；未算作应用通过或失败。

实际 Web 全屏时视频时间 `4.282→7.964s`，控制栏隐藏后字幕仍显示，MV 结束时 `fullscreen=false/videoPage=false/playerPage=true`，页面错误为空。Android 最终包同样显示歌词与译文，控制栏隐藏不影响字幕；观看生成的 90 秒 MV 自然结束，确认切到「10 远山」并返回完整播放器。较早短时 seek 尝试未提前触发结束，留档而不计为 seek 验收；返回桌面时截到的过渡帧也单独保留，不冒充停稳画面。

新审核入口 `/home/hanxi/work/songloft-review/lynx-current-device-20261021/review.html` 提供 11 张最终包/最终 Web 原始截图；此前 14 张功能截图、旧包、失败日志保持独立。验证清单、代码指纹、原生单测 XML 和包校验同目录保存。iOS/HarmonyOS 设备、签名、真机与默认玻璃效果的 Not run 边界不变。未提交、推送或发布。
