# songloft-org/songloft#540：歌单滚动条定位

[Issue](https://github.com/songloft-org/songloft/issues/540) 报告「歌单进度条下滑会闪回第一首」，没有设备、版本或评论。[English](../en/project/issue-540.md)。

## 原因与修复

- 分页和布局尚未到位时，滑块一直取 `currentIndex`，初始值为 0；拖动目标虽然已保存，滑块仍回到第一首的位置。改为等待期间显示请求的位置，实际歌曲气泡仍取可见行。
- 原生 `scrollToPosition` 一调用就清除请求，成功回调也再次清除。数据到达不代表原生列表已布局，调用成功也不证明目标可见。原生与 Web 统一等待可见行确认，并沿用每 200ms、最多 25 次的布局重试；失败、超时、空页和离开页面不会无限重试。调用前核对请求代次，拒绝旧请求移动新位置。
- 快速拖动时，触底与定位续拉可能在状态更新前重复调用 `fetchNextPage`，默认行为会取消并重发同一页。设置 `cancelRefetch: false`，让重叠信号复用进行中的分页请求；新增页面回归覆盖该契约。
- 不改变排序、后端接口、普通打开歌单的分页方式或播放队列。

## 验证对象与证据

仓库：`songloft-org/songloft-player-lynx`，基线 `eb396153c0a05ddd8a2ba940da87211d1a1cd36e` + 本次未提交工作树。2026-10-25，Linux x86_64 / Node 22.17.1 / pnpm 11.15.1。最终差异标识和命令结果见 `/tmp/songloft-540-verification.json`。

- 新增原生布局延迟回归，并在分页用例中断言等待期间的滑块位置。旧实现 2 项失败、1 项通过（`/tmp/songloft-540-regression-before.log`）；修复后 3 项通过（`/tmp/songloft-540-regression-after.log`）。覆盖原生成功但未移动、真正可见后停止重试、超时和卸载。
- 最终隔离副本使用旧页面和旧列表、配合新测试，3 项按预期失败、23 项通过（`/tmp/songloft-540-negative-final.log`）；最终页面/列表 26 项通过（`/tmp/songloft-540-focused-final.log`）。最初副本的 Vite 文件访问范围配置失败不计为反向证明，补齐范围后才得到上述断言失败。
- 最终生产 `pnpm run build` 同时产出 Lynx/Web（`/tmp/songloft-540-production-final.log`）；保留已知 `touch-action` 编码警告。带测试桥的 Android bundle 与 `./gradlew --no-daemon assembleDebug` 通过（`/tmp/songloft-540-debug-final.log`、`/tmp/songloft-540-gradle-final.log`）。此前构建期间调整测试文件，被新鲜度闸门拒绝打包；停止并发构建、冻结源码后按顺序重跑通过，不把拒绝/中断计为通过。
- 最终 `pnpm test --maxWorkers=4`：348 文件 / 3704 项通过；`pnpm exec tsc -b` 通过（`/tmp/songloft-540-full-final.log`、`/tmp/songloft-540-types-final.log`）。验证源码标识 `aed8ac66643cc8195284749fc7e6b381f34e12662379a68034fb0be5aa276098`，四个源码/测试文件的 SHA-256 见验证 JSON。
- Chromium 121，390×844，130 首合成歌曲：普通页面仅加载首批 20 首；实际触摸与鼠标快速拖动均在 offset 0/20/40/60/80/100 各请求一次，最后滚动偏移为 6592、第 104 首位于顶部、滑块为 20.155%，无页面异常。`/tmp/songloft-540-{touch,mouse}-final.{json,png}` 保留结果和截图。夹具只使用本地临时服务与测试账号，不操作用户曲库。
- Android API 34 / x86_64 + ARM 转译模拟器使用最终 APK `594b18c492ed83ba28765a7815aae43d5e8cb38642cc4b718fc06d05c3138810`；包内与复制的测试 bundle 哈希均为 `64d9705ea94ad9411c6f6f51eb85496d986b214f9d1e8e64a8372c430cf7daa3`。实际拖动跨分页后 `scrollY=6528`，第 104 首 top=407 位于 343–820 的列表视口内；普通滑动后 `scrollY=6741`，一秒后仍为 6741，没有被定位重试拉回。见 `/tmp/songloft-540-native-{result.json,after.png,final.log}`。
- 保留早期失败：并行检查期间鼠标未在期限内到达目标、原生交互被 System UI ANR 弹窗挡住；分别保留在 `/tmp/songloft-540-mouse-under-load.json` 与 `/tmp/songloft-540-native-under-load.{json,png}`，不计为通过。全量检查结束、移除系统弹窗后，最终 APK 与鼠标分别单独复验通过。启动/安装的环境失败和模拟器崩溃也保留在验证 JSON 中。

Not run：Android 真机、iOS / HarmonyOS 设备及宿主构建（宿主无修改，当前为 Linux 环境）、远端 CI（未推送）和正式发布。浏览器与 Android 模拟器结果不代表报告人原机或其他平台验收。

上述未提交工作树为本地验证快照。用户于 2026-10-25 明确授权提交、推送并回复 songloft-org/songloft#540；子仓库先提交，父仓库随后同步指针，实际提交、CI、开发包与评论状态以 GitHub 交付记录为准。没有正式发布或关闭 Issue 的授权。提交信息：`fix(playlist): 修复分页定位时滚动条跳回顶部 (songloft-org/songloft#540)`。
