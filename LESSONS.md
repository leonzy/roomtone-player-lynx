# Lynx 客户端开发经验

## 范围与来源

记录songloft-org/songloft-player-lynx 的双线程、共享 JS 与四端宿主行为。流程见 [本地 AI 开发流程](docs/guides/ai-development.md)，公共宿主约束见父仓库。已有 AGENTS 和业务文档仍是权威规则，LESSONS 链接证据而不复制历史全文。

## 记录与升级

每条含规则、适用范围、完整 owner/repo#编号、失败/修复 commit SHA、实际验证和 Done right 示例；没有正确示例时写待补。Seen 只统计不同日期的独立事件，同一事故重复复盘不增加。三个日期后提出升级并标记规范位置，已有铁律/严重问题立即处理。与 [英文版](LESSONS.en.md) 同步，不虚构历史次数、修复结论或设备验收，敏感信息脱敏。

## 条目

### WEB-002：桌面手机尺寸不能替代 Android Chrome 的 IME 与浏览器栏验证

- 范围：Web `Input` / `TextArea`、异步受控值回写和 fixed 导航；无关联 Issue。
- 证据：2026-10-16，基线 `209f6c88b071c187064194a2ae197e48c23fa6c3` 在 Android 34 / Chrome 113 / Gboard 模拟器中，单字输入触发约 9.5ms 只读脉冲，DOM 焦点仍在，系统键盘却收起；912px 的根高于 856px 实际视口，胶囊超出 48px。此前 390px 桌面截图未覆盖这两种系统行为。
- 规则：分别验证系统 IME 状态、真实连续/组合输入和浏览器 chrome 下的几何。只取消只读锁仍会因旧回写覆盖新输入而丢字；第一版实际丢失 `l`，新增四项异步回写测试后全部反向失败。输入确认值按顺序消费，重复值不能提前确认后续事件。
- Done right：Web 不临时设为只读，跳过浏览器已应用的 value 回写；保留原生锁。宿主使用动态视口和 Android `resizes-content`。源码/发行控制器 36 项回归、全量 3580 项、类型、双 bundle 和 87 项发布检查通过。设备最终结果见 [记录](docs/project/web-android-input-viewport.md)；证据 `/home/hanxi/work/songloft-review/android-web-input-20261016/`。
- 后续：动态视口也会把 fixed 胶囊顶到 IME 上方；上批把这个副作用误列为通过。新增验收必须检查输入时隐藏、无命中区、收键盘后恢复和播放不中断，不能只断言底栏在缩小视口内。HTTP 键盘检测没有通用精确 API，焦点/高度回退的边界与实际模拟器证据见同一记录；ADB 输入会重开 IME，不冒充真实外接键盘。
- Seen 1× (2026-10-16)。状态：经验；不把单版本模拟器扩大为 Android 真机、最新 Chrome 或 Safari 验收。

### WEB-001：HTML 打包改动必须经过实际归档验证器

- 范围：嵌入 Web HTML、`copy-bundle-web.mjs` 与 `verify-package.py`。
- 证据：2026-10-16，`6edca8561eeaa375c82c725c2cfd097f0ef3f996` 的本地 JS/打包测试与真实浏览器通过，但 CI `38883061236` 的 Web embedded 因新增 `<base href="/">` 被正则当作空资源路径而失败。此前只跑了通用 verifier 夹具，没有把新 copy 输出接入归档验证器。
- Done right：验证器用 HTMLParser 区分 base 与资源，分别校验 embedded/standalone 的 base；新回归对真实 copy 输出归档并调用验证器，同时删除真实资源确保仍会拒绝缺文件。隔离旧 verifier 时新回归失败，修复后 85 项发布检查和 CI 同款真实归档命令通过。证据 `/home/hanxi/work/songloft-review/lynx-default-20261016/logs/{lynx-ci-web-job,archive-verifier-negative,lynx-release-tests-archive-fix}.log`。
- Seen 1× (2026-10-16)。状态：经验；修复提交与后续 CI 以本次交付为准，取消的旧构建不算通过。

### LYRIC-001：封面背景被辅助功能停用时应明确说明

- 范围：Lynx 播放器与外观设置，songloft-org/songloft#523 的 2026-10-16 反馈。
- 证据：基线 `1ad0eaf1cba340d644660f64198fed6b8b6d6d6d` 的实际 Web 构建在增强对比度或降低透明度时卸载封面、显示纯色；旧说明只谈文字/分隔线或实心表面，未说明播放器封面背景会消失。反馈截图与该路径一致，但设备开关未确认。
- Done right：在实际设置 UI 分别关闭两项并确认封面恢复，补齐中英文副作用说明；保留无障碍策略，不把截图匹配当设备根因证明。对照截图与命令见 [#523 后续记录](docs/project/issue-523.md)。
- Seen 1× (2026-10-16)。状态：经验；验证时文案尚未提交，最终验证对象见任务记录。

### LIST-001：虚拟列表委托测试不能替代大队列运行时验收

- 范围：播放队列、共享 `VirtualList` 和 Web / 原生运行时，songloft-org/songloft#525。
- 证据：2026-10-15，基线 `e924f05a334254b6eb754927b2808f87a7943302` 的 80 项相关测试通过，其中 500 首测试 mock 了列表，只验证组件委托。真实 30,000 首队列在 Web 点击后页面查询超时，在 Android 34 / ARM64 转译模拟器中也达到原生测试桥 15 秒期限；媒体会话继续播放同一歌曲。
- 规则：组件名、原生布局虚拟化及 mock 的结构断言不能证明背景线程只处理可见条目。按实际规模分别验证 JS 条目构建、布局、测量、交互响应和媒体进度；100 / 500 首通过不能外推至 3 万首。
- Done right：按视口有界创建行，并在大字体下保持行高和偏移一致；保存播放进度只更新小键，大队列变化分批编码。最终 3,543 项测试、Web 四组和 Android 3 万首实际打开/队尾/删除/切歌通过，自动保存期间 20 次 UI 查询最大响应 35ms。完整对象、基线失败、最终证据及 Not run 见 [#525 记录](docs/project/issue-525.md)。
- Seen 1× (2026-10-15)。状态：经验；修复位于未提交工作树，同一事故不递增。真机与其他原生平台仍未验收。

### RELEASE-001：确认提示走 stderr，取消必须返回失败

- 范围：`scripts/bump-version.mjs` 及父仓库一键发布的命令替换调用。
- 规则：stdout 留给成功版本结果；计划与确认提示实时写 stderr。空回车、拒绝与 EOF 均取消并返回非零，避免编排继续执行；交互读取须能在 EOF 正常结束。
- 证据：2026-10-15，基线 `0de993ff272ee29df96c8401b46df56256646438` 在父脚本捕获 stdout 时隐藏提示，回车退出 0；新增 5 项相关回归在旧实现全失败，修复后通过。完整记录及 Not run 见 [本批进展](docs/project/progress.md#2026-10-15--发布确认交互)。
- Done right：发布工具 81 项通过；PTY 实际命令替换在输入前显示版本与提示，回车退出 1 且无写入，yes 只创建预期本地提交/tag，夹具远程保持不变。证据 `/tmp/songloft-release-terminal-result.json`。
- Seen 1× (2026-10-15)。状态：经验；本次未提交、推送或正式发布。

### UI-003：颜色 getter 正确不代表常驻 SVG 已更新

- 范围：内置配色、服务器主题包与常驻导航，songloft-org/songloft#523。
- 规则：ThemeProvider 更新继承的 CSS 变量，不会自动重渲染相同 children；原生 SVG 的具体颜色必须由其常驻拥有者显式订阅。测试读取已渲染 SVG 内容，并在真实截图中核对图标、文字和选中背景，而不是只调用颜色 getter。
- 证据：2026-10-15，基线 `4d73b793890494301d44b1a19e9df4dd178429e3` 的本批初版截图中，玫瑰色文字/背景已更新而底栏齿轮仍是蓝色，getter 断言却通过。旧 ShellLayout 的隔离渲染回归在 `#984061` 断言失败；补齐配色/主题包订阅后 13 项导航回归与最终 3531 项全量通过。修复源码指纹与保留截图见 [本批记录](docs/project/issue-523.md)。
- Done right：ShellLayout 订阅 `subscribeBuiltInPalette` / `subscribeActiveThemePack`，同一已挂载图标经过蓝色→玫瑰→主题包→恢复玫瑰，实际内容同步；浏览器逐一断言六种配色的当前 SVG 与根强调色一致。
- Seen 1× (2026-10-15)。状态：经验；未达到三日期升级阈值。

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
