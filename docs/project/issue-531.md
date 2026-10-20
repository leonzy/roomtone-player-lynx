# #531 电台断流重连

2026-10-20，关联 [songloft-org/songloft#531](https://github.com/songloft-org/songloft/issues/531)。Lynx 基线 `f3f78b3aae6e74323b963a9e8c940bf74b3613b5`，最终提交和 CI 状态以 Git/GitHub 交付为准；本记录描述提交前验证工作树。用户已授权同时修复 Flutter/Lynx、提交、推送并回复 Issue。

## 原因与行为

旧播放器把直播的 completed 当作歌曲播完，按播放模式切台；error 只重试三次，耗尽后也切台。直播现在按 1、3、9、10 秒重试，后续上限保持 10 秒，始终连接当前台的直播位置。断流不消费优先队列或按歌曲计数的睡眠定时器；普通歌曲维持已有有限重试策略。

缓冲时宿主也会发 paused，不能用该事件推断用户暂停。Android MediaSession、iOS MPRemoteCommandCenter、HarmonyOS AVSession 与 Web MediaSession 增加明确的 `play` / `pause` remoteCommand：宿主立即执行，JS 同时维护直播播放意图。暂停、停止、清队列、换台、重置和定时停止取消重连及在途加载，重新播放恢复当前台。实际媒体键测试另发现 Android 系统 STOP 未走通知栏的自定义退出命令，JS 仍在重试；补齐 ForwardingPlayer.stop 到引擎停止及 remoteCommand 的路径。

系统媒体控制需要安装配套的新原生宿主；只替换 JS 的旧壳不能补出 play/pause 意图事件。

`docs/reference/native-modules.md` 与 `docs/project/progress.md` 历史上只有中文，本批同步命令表和进展；有意不为整个旧文件新增翻译。本双语记录与英文 handoff 提供新增行为及事件的英文说明，见 [English](../en/project/issue-531.md)。

## 验证对象与证据

证据目录 `/tmp/songloft-531-lynx-20261020/`，使用临时数据库与合成实时 MP3，不使用私人曲库。最终源码差异（`git diff --binary -- src android ios harmony web scripts`）SHA-256 为 `d953d8a779ac407ae6ecc1473179da53ba5676219acecbc481f723835f2576ca`；最终 Debug APK 为 `d8fa380e542f506815018aa7a2e56eca16b4ef903ad0f321f40f6d03b605fc0d`。后端临时实例端口 58341，上游 58342，Web 预览 38341。

| 检查 | 实际结果 |
|---|---|
| `pnpm exec tsc -b` | 通过 |
| `pnpm run build`、`pnpm run build:web` | Lynx/Web 双产物及部署产物通过 |
| `pnpm test` | 336 文件，3630 项通过 |
| `pnpm run test:release` | 87 项通过 |
| 隔离旧 store + 新回归 | 12 项失败、4 项通过，另有旧实现的 offline 未收敛异常；播放模式、重试耗尽和取消路径捕获原缺陷 |
| HarmonyOS 实际模块源码适配器 | 6 项通过；不代表 HAP 编译或设备验收 |
| Swift 6.2 `-frontend -parse` | 语法通过；不代表 Apple SDK 编译 |
| `node --check web/audio-host.js` | 通过 |
| Android Debug bundle + `./gradlew --no-daemon assembleDebug` | 通过 |

Android 最终 APK：Emulator 35.6.11 / API 34 / Mesa llvmpipe，开启“减少透明度”；真实 MP3 断网 50 秒仍为电台 A、两项队列不变，恢复后进度 11659→15187ms。通过 `cmd media_session dispatch` 发 pause/play/stop：暂停后联网 12 秒无新请求，播放后进度恢复，STOP 清空队列，联网 11 秒无新请求。最终结果 `android-result.json`、截图 `android-playing.png`。

保留中间失败：首轮断网 110 秒保持 A，但上游夹具退出，重启上游后进度 32599→36109ms、暂停/恢复通过；初次 STOP 未取消重连促成上面的补修。新 APK 的一轮 `input keyevent` 暂停没有生效，改为系统媒体服务直接分发后完整通过；不把键盘事件注入等同于确认命令已送达。全部原始日志仍保留，不能只选择成功片段。结合已有下一首 Range 预取代码、合成 MP3 的有限时长与实际媒体源快照，判断上游 B 请求属于预取；未单独捕获 Worker 预取的请求头。实际当前源/媒体会话及队列仍为 A，不能仅凭 HTTP 请求断言切台。

最终生产 Web 在 Docker 无头 Chrome 121 实际打开、点击电台播放：断网 30 秒持续重连 A，恢复后真实进度从 0 前进至 2.37 秒；媒体暂停后联网 11 秒无新请求，系统播放恢复后进度 4.44→6.94 秒，所有 Audio 元素始终使用 A。结果 `web-final-result.json`，截图 `web-final.png`。首轮 110 秒的媒体源快照及统计脚本失败另存 `web-initial-result.json`，不将其当作完整媒体控制验收。

Debug 桥验证后重建生产 Lynx/Web 与 Web 部署产物，最终 87 项发布检查、420 项受影响回归通过。3630 项全量和类型验证后仅追加 Android STOP 接线；最终已重跑受影响的原生契约、Gradle 与上述设备场景。验证清单和最终工作树对象为 `validation.json`、`worktree-final.json`。

Not run：报告人 Android 硬件、真实弱网/长后台、iOS 真机及 Apple SDK 本地编译、HarmonyOS 本地 HAP/设备、DLNA 电台重连。Linux 环境不能替代 Apple 工具链；HarmonyOS 编译跟踪推送后的同 SHA CI。原生渲染已有的默认效果/模拟器限制单独记录，不把音频断言扩大为视觉全面验收。不打正式版 tag，不关闭 Issue。
