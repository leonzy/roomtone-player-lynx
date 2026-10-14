# Lynx 客户端开发经验

## 范围与来源

记录songloft-org/songloft-player-lynx 的双线程、共享 JS 与四端宿主行为。流程见 [本地 AI 开发流程](docs/guides/ai-development.md)，公共宿主约束见父仓库。已有 AGENTS 和业务文档仍是权威规则，LESSONS 链接证据而不复制历史全文。

## 记录与升级

每条含规则、适用范围、完整 owner/repo#编号、失败/修复 commit SHA、实际验证和 Done right 示例；没有正确示例时写待补。Seen 只统计不同日期的独立事件，同一事故重复复盘不增加。三个日期后提出升级并标记规范位置，已有铁律/严重问题立即处理。与 [英文版](LESSONS.en.md) 同步，不虚构历史次数、修复结论或设备验收，敏感信息脱敏。

## 条目

### UI-002：滑块松手和边界测量要属于同一手势

- 范围：lynx-ui 3.135.4 共享滑块和旧原生壳能力，songloft-org/songloft#520。
- 规则：不能只在已开始更新值时处理松手；边界测量未完成也要记录结束，并在同一手势的最后位置得到结果后提交。新手势/卸载拒绝旧回调；轨道和内部填充条分别测量。
- 证据：2026-10-14，基线 `992eb4930bc686f7160a1ca0bfbab42368dad284` 的库在 `getRectByRef` 返回前松手时丢失 commit，迟到回调仍能开始拖动；真实控制器夹具中旧库 3 项失败、补丁后 4 项通过。API 34 实际测量缓存填充条宽度为 0，显示值和刻度不能证明填充条或触摸过程正确。证据 `/tmp/songloft-520-slider-{negative,final}-test.log` 与 [#520 记录](docs/project/issue-520.md)。
- Done right：锁定 source/dist 补丁，覆盖短点按、末次移动、跨手势测量和卸载；内部填充明确宽度并居中。旧 Android `exitApp` 只移后台，JS 新入口同时消费宿主 `androidExitAppStopsPlayback` 能力，旧壳不显示误导入口，不能只看方法名存在。
- 坐标证据：API 34 中点触摸 x=196.36，但公共边界 helper 传 relativeTo:'' 得到 left=0，比例误为 0.597。原生查询改为 null，与 LynxView 触摸坐标一致；Web clientX 对应 screen。最终控制器 8 项通过，旧库 7 项失败。本机/服务端两端及中间档位实际保存正确，见 `/tmp/songloft-520-coordinate-{tests,negative}-final.log`、`/tmp/songloft-520-lynx-{device,server}-final.json`。
- 控件补充：ProgressBar 还通过渲染前 dragging 闭包丢弃首个值，与已填入初值的缓存/字号滑块不同。2 项控件回归旧实现失败、修复后通过；API 34 点按 25%/50%/75% 实际跳到对应 30/60/90 秒并继续播放。这是同一事故的补充验收，不增加 Seen。
- Not run：鸿蒙 4.2 实机；普通 Android 未复现全部鸿蒙触摸症状，不把确定性公共回归视为那台设备已通过。
- Seen 1× (2026-10-14)。状态：经验；原生/持久化最终证据见本批记录。

### TEST-001：读取发布产物的测试必须在构建完成后执行

- 范围：Lynx/Web 构建与发布产物闸门。
- 规则：构建会清理 `dist/`；依赖 `dist/main.lynx.bundle` 的测试不能与构建并发。先完成双产物构建和 Web 打包，再运行完整测试。
- 失败：2026-10-14，songloft-org/songloft#520，基线 `a69a45f4c3048171ddbc1f0f33c9922fa3af74d8` 的未提交工作树中并发运行构建与测试，`release-build.test.ts` 报 `ENOENT`；日志 `/tmp/songloft-520-lynx-tests.log`。这是验证编排问题，不能计为源码回归或跳过闸门。
- Done right：构建完成后顺序执行，`/tmp/songloft-520-lynx-tests-final.log` 的 3494 项通过；随后增加歌词可见性用例的最终验证记录见 [#520](docs/project/issue-520.md)。
- Seen 1× (2026-10-14)。状态：经验。

### UI-001：滚动提示要核对实际可见歌曲和各宿主的回调形态

- 范围：虚拟列表定位、首字母和序号提示（songloft-org/songloft#518）。
- 规则：气泡出现不等于定位成功；用实际列表位置或可见行确认歌名和序号。原生 `attachedCells` 使用列表相对坐标；Web `getVisibleCells` 的数组缓存可能滞后，改用实际行坐标二分查询。Web 离屏项须提供贴近真实行高的占位估算，滚动偏移除以行高仅能暂作兜底。一次行坐标查询在途时合并最新待查位置，结束后补读，避免积压和漏掉最后一次滚动；拒绝过时回调。void `scrollToPosition` 成功不证明界面已接纳新行，必须用目标可见确认，有限重试。
- 失败证据：2026-10-14，本批未提交初版在浏览器中列表已滚至第 14 首，气泡仍为第 1 首；`/tmp/songloft-518-ui/lynx-full-drag.png`、`lynx-debug.json` 及已安装 web-elements 实现确认回调形态差异。
- 修复证据：当前未提交工作树的可见行归一化、实际滚动事件兜底、void 调用收尾、64px 歌曲占位估算和分页定位；本条所属提交以 Git 记录为准。相关单测验证原生对象、Web 数组坐标、不可变查询链、交错异步回调和无后续滚动事件的稳定位置；最终浏览器两次请求续拉到 offset=100，滚动偏移 6592 时均确认第 104 首「夜空中最亮的星」位于列表顶端、提示 `Y` 与 `104 / 130`，见 `/tmp/songloft-518-ui/lynx-final-{result,repeat}.json`；验证对象见本批 [记录](docs/project/issue-518.md)。
- Done right：气泡、列表可见行、真实分页请求和刷新后的偏好分别验证；长时间按住滚动条时保持气泡，并在显示期间确认最后一次滚动后才稳定的虚拟行。视口未移动时，新查询尚未返回不应废弃旧查询的有效响应；只拒绝已应用更新响应之前的结果。浏览器断言分别记录按住和松手后的提示，离开页面取消旧定位和查询定时器。
- Seen **1×**：2026-10-14。状态：经验；原生设备仍待验收，不将 Web 验证当成原生结果。

### API-001：升级动作必须验证请求体与服务端通道契约

- 范围：Lynx 后端升级检查、启动请求与页面测试。
- 规则：不能把返回 200 的空写入 mock 当作升级动作证据；同时验证当前通道、对应版本说明和实际 POST JSON。在线升级只允许当前 stable/dev 通道，非 Docker 不提供动作。
- 失败证据：[songloft-org/songloft-player-lynx#11](https://github.com/songloft-org/songloft-player-lynx/issues/11) 截图及基线 [`0651222`](https://github.com/songloft-org/songloft-player-lynx/commit/0651222b87b5a97daebef7e48c5d497c32a7e71a)：页面发 `{}`，后端因缺少 `version_type` 拒绝；旧 mock 未检查请求体。
- 修复证据：源码工作树 `faec7a428a9675dc1d3e5c98191d963555b8616c409e93658daae6f651e8389b`；隔离旧页面的 5 项回归失败，最终相关 36 项通过，浏览器记录正确 dev/stable 请求和拒绝重试。详情见 [progress](docs/project/progress.md)；真实服务端二进制替换及 Android 设备未验，修复提交以包含本条的 Git 记录为准。
- Done right：`SettingsApi.startUpgrade(channel)` 发 `{version_type: channel}`；关于页使用真实 API 类、传输测试读取 JSON，浏览器夹具拒绝错误通道并记录请求，而不是只确认按钮存在。
- Seen **1×**：2026-10-14。现有 API 契约继续执行，未达到三日期升级阈值。
