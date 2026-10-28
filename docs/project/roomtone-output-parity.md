# Roomtone 播放输出移植 / Playback output port

## 2026-10-28 NAS 静音排查 / NAS silent playback

实际 NAS 日志确认 Cocoon 完成 AirPlay 握手/校时，但上游裁剪 ffmpeg 缺 s16le muxer，进程退出 234，音箱 samples=0。运行镜像改用 Alpine 完整 ffmpeg，原实际 FLAC 静默解码 1 秒得到 176400 字节 44.1kHz 双声道 PCM；Dockerfile 同步去掉裁剪 ffmpeg 覆盖。Web 宿主原先关闭 EQ 也创建 AudioContext，可能把媒体输出接入被浏览器挂起的图；现关闭时不创建，普通 play 拒绝也通过既有错误事件上报。新增宿主回归，3 项通过，Web 嵌入构建通过；NAS 实际二进制 Build Time=2026-10-28_web-audio-fix，已确认服务输出新脚本。没有向音箱测试播放，实际听感等待用户刷新后反馈，不把解码自检当成声音已恢复的证据。

NAS logs confirm AirPlay negotiation/timing succeeded but the slim upstream ffmpeg lacked the s16le muxer, exiting 234 with zero samples sent. The runtime image now uses full Alpine ffmpeg; one second of the user's actual FLAC decodes silently into 176400 bytes of stereo 44.1kHz PCM. Dockerfile no longer overwrites the package with the slim binary. Web disabled EQ no longer creates a potentially suspended AudioContext; ordinary play rejection is surfaced via existing error events. Three host regressions and embedded Web build pass; NAS runs the confirmed web-audio-fix binary and serves the new script. Speaker playback was not initiated. User listening feedback is pending; decode self-tests do not establish audible recovery.

## 2026-10-28 leonFN 新设备空 EQ / Fresh-device null EQ

部署到原 Songloft 数据库后，实际 /players 中新发现音箱返回 EQ.bands=null。旧 Zod default 只处理 undefined，导致任一新设备使整批输出解析失败，界面错误显示没有区域。bands 现将 null/undefined 归一化为 10 个零，queue.items 同样兼容 null；不把未知的实际类型静默吞掉。新增新设备完整 outputs 解析回归，相关 4 文件 / 21 项、类型、双构建通过。leonFN 已强制重建容器并确认实际运行二进制 Build Time=2026-10-28_fix-null-eq，原登录及挂载正常，三台 RAOP 在线且没有播放。飞牛应用通过官方 CLI 停止/启动重新注册，状态 running；容器标识恢复 songloft 以保持应用管理兼容，镜像仍是 Roomtone。NAS 桌面图标的用户会话显示未直接检查，浏览器只读打开到登录页后关闭，未再次接受协议或进行播放。

On the original Songloft database, newly discovered speakers return EQ.bands=null. The old Zod default handled undefined only and rejected the entire output snapshot. Nullish bands now normalize to ten zeroes, and nullish queue.items to an empty list; invalid non-null types still fail validation. The fresh-device regression, four files / 21 tests, types and both bundles pass. leonFN's recreated container runs the confirmed fix-null-eq binary; original credentials/mounts work, three RAOP devices are online and playback is idle. FN's official stop/start re-registers the application, reported running. The compatibility container identifier is songloft and the image remains Roomtone. The user's NAS desktop session was not inspected directly; the read-only browser check stopped at login without accepting terms or playing audio.

## 2026-10-28 输出面板产品调整 / Output panel refinement

保持原圆角胶囊，收藏移至歌曲旁，更多菜单移到区域/音量之后的最右端。休眠使用时长预设、明确状态与主确认按钮；音频控制区分全局处理与分设备 EQ，频段改为草稿滑杆，保存才写服务器；转换增加来源摘要与操作说明；区域设置分外观与设备同步卡片，图标名称使用中英标签。修正音量 SliderThumb 层级与轨道定位。正在播放页新增区域入口，沿用原音量入口，避免重复。

The original capsule is retained, with favorite beside song metadata and More at the far right. Sleep has presets/status/primary action; audio separates global processing and per-device draft EQ sliders; transfer distinguishes source/targets; settings groups appearance and device synchronization with translated icon names. Volume thumb nesting/track positioning is corrected. Full player adds a zone entry while retaining its original volume entry.

类型、Lynx/Web 双构建、Go 嵌入构建通过，相关 6 文件 / 35 项通过。实际 1280×800 打开四个工具面板、确认滑块对齐和正在播放页区域弹窗；未执行确认、转移、播放或音量变更。检查页关闭，临时视口恢复。截图 sleep/dsp/transfer/settings-redesign.png、capsule-final.png、volume-aligned.png、full-player-zones.png，日志 lynx-output-product-{tests,build}.log。原生编译与设备验收 Not run。

Types, both bundles and embedded Go build pass; six affected files / 35 tests pass. Browser inspection at 1280×800 opens all four tool panels and verifies volume alignment/full-player zone selection. No saves, transfers, playback or volume changes; verification tabs close and viewport resets. Named screenshots/logs are under the local roomtone-tools directory. Native compilation/device acceptance remain Not run.

频谱插件仅分析：当前公开 player bridge 提供播放状态/控制，没有 PCM/FFT 订阅。真实频谱需要由实际解码宿主提供按区域标识的分析数据（服务端网络输出与本机引擎分别处理），插件负责绘制；未实现新接口、插件或频谱管线。

Spectrum is analysis only: the public player bridge exposes playback state/control but no PCM/FFT subscription. A real analyzer requires zone-scoped data from the actual decoding host, separately for server outputs and local engines; plugins can render that data. No spectrum API, plugin or processing pipeline was implemented.

## 2026-10-28 区域列表与空闲底栏修正 / Zone picker and idle footer correction

关闭页面后的旧 Lynx Web 已由服务器标离线，但选择器仍列出持久设备，造成重复印象。现在播放区域选择器隐藏纯离线本机组，网络音箱仍保留离线展示；设备管理保留记录以免丢失名称、设置与队列。不同的在线客户端不按名称合并，同名时才加身份提示。列表不显示内部 exact 字段，只对正在播放的区域显示暂停按钮。

The closed Lynx Web client was correctly marked offline, but persisted devices remained in the picker. Purely offline local groups are now hidden there; network speakers and management records remain available. Distinct online clients are not merged by name. Internal sync identifiers are removed and pause appears only for playing zones.

未加载歌曲时 MiniPlayer 返回空，不再渲染输出悬浮条；设备管理入口保留在设置的播放页。窄屏无歌曲时恢复 80px 导航留白。新增离线客户端选择器回归，相关 5 文件 / 30 项、类型与双产物构建通过。无播放或音量操作。

Without a loaded song MiniPlayer renders nothing; output management remains in Playback settings. Narrow layouts restore the 80px no-song inset. Five affected files / 30 tests, types and dual bundles pass, including a closed-client picker regression. No playback or volume operations.

## 2026-10-28 缺口补齐与复核 / Gap fixes and recheck

以下是本轮已完成的源码修正，覆盖下方审计记录中的缺口：派对 join/leave/end、退出停止/继续、2 秒状态刷新与漂移提示；EQ 保存解析并回填服务端结果；区域图标实际渲染；standby 解析、状态说明及候选禁用；转换无曲目/busy 保护及处理中返回/关闭保护；固定音量按钮禁用；闹钟全部歌单分页、只调音量选项及合法时间范围；诊断指标卡/槽位告警/owner 明细；本机未注册时的选择入口；iOS 中断 shouldResume、重复中断、主动暂停/停止/换源取消恢复意图及耳机拔出暂停。

Source fixes cover the findings below: valid party membership/end actions and leave modes, polling/drift status, normalized EQ feedback, saved icons, standby state/guards, transfer and fixed-volume guards, alarm pagination/volume-only/time validation, metric cards/saturation/owner details, local fallback and iOS interruption/resume intent cancellation/headphone removal.

复核：类型检查通过，输出及覆盖层 5 文件 / 25 项通过（新增 EQ 回填、standby 保留及待机禁选回归）；Lynx/Web 双构建通过；git diff --check 通过。原生契约 316 项中 315 通过，1 项为此前基线已复现的 Swift callback 源码 CRLF 比较失败。日志 lynx-parity-gap-{final,tests,build}.log。本轮未运行全套测试；没有播放、调音量或安装 SDK。iOS 改动仅完成源码核对，Apple 编译与系统中断真机测试仍为 Not run，不能称跨平台验收已完成。

Recheck: types pass, five output/overlay files and 25 tests pass, including three new regressions; both bundles and whitespace check pass. Native contracts: 315/316 pass; the remaining Swift callback CRLF comparison reproduces in the earlier baseline. No full-suite rerun, playback, volume changes or SDK installation. Apple compilation and interruption/device behavior remain Not run; source completion does not establish native acceptance.

## 2026-10-28 再核对历史发现（已按上节修正） / Historical audit findings (addressed above)

本节优先于下方早期“功能范围”的概括。审计对象：父仓库 `64af28f03cda123e660b4ca7262f04cd369cc204` 加当前工作树；Flutter `1b08568c45e5b3e310333f388d9b4a340e5f499d`；Lynx `ab96b325565241cc62850fba01e5efe63385754b` 加当前未提交移植。此次只核对与执行无声单测，没有修改产品代码、播放音频、调整音量、安装 SDK 或推送。

This section supersedes the earlier scope summary. Audit targets are the parent, Flutter and Lynx revisions above, including the current parent/Lynx working changes. This audit changes documentation only and runs silent unit tests; no product changes, playback, volume changes, SDK installation or push.

| 状态 / Status | 差异与代码证据 / Difference and code evidence |
|---|---|
| 明确错误 / Confirmed defect | `OutputPanels.tsx:Party` 发 `add/remove`，后端 `internal/handlers/playback.go:PartyGroups` 只接受 `join/leave/end`；成员按钮会返回 400。Flutter 使用正确动作。Lynx 还缺结束派对、退出时停止/继续的选择。 / Member actions use unsupported names and receive 400; End Party and stop/continue leave choices are missing. |
| 明确错误 / Confirmed defect | `OutputPanels.tsx:Eq` 只在挂载时用 `device.EQ` 初始化本地 profile，保存忽略返回值；刷新输出缓存不会重置仍挂载的编辑器。服务端重算 preamp 后 UI 仍可能显示旧值。Flutter 保存后重新读取 EQ。 / Saving does not adopt the server-normalized profile, leaving stale preamp values in the mounted editor. |
| 展示未接完 / Incomplete wiring | 区域设置保存 `group.icon`，但 `zoneIcon()` 完全不读取该字段，只有 link/computer/speaker。Flutter 按保存的图标显示。 / The saved zone icon is ignored by the icon resolver. |
| 状态遗漏 / Missing state | `api.ts` 的设备 schema 没有 `standby`，解析时丢弃该字段；详情没有当前待机状态，编组候选只检查 Online 与同步等级。Flutter 解析并显示待机状态，并有相关不可用保护。 / The device parser strips standby, preventing matching status display and availability guards. |
| 交互保护不足 / Incomplete guards | 转换区域目标仅按在线状态禁用，未按源 song_id 禁用；全局 busy 会阻止重复请求，但按钮仍可点且弹窗可在请求中关闭。Flutter 禁用无曲目目标及处理中关闭。Lynx 固定音量模式也只禁滑块，静音/加减仍可点（后端会忽略）。 / Transfer lacks no-track/visible busy guards; fixed-volume buttons remain actionable although ignored by the server. |
| 功能展示简化 / Simplified UX | `Metrics()` 直接显示 JSON，缺 Flutter 指标卡与解码槽位告警；区域列表没有组同步等级/对齐中提示；首次本机注册失败时没有 Flutter 的可选本机占位区域。 / Metrics remain raw JSON; group alignment status and the selectable pre-registration local fallback are missing. |
| 闹钟边界遗漏 / Alarm edge cases | 只读取前 100 个歌单；选中歌单后没有回到 playlist_id=0（只调音量）的选项；时间仅检查两位数字格式，不检查小时/分钟范围。 / Playlist selection is capped at 100, cannot restore the volume-only option after selecting a playlist, and time validation checks shape only. |
| 新增 Flutter 行为未对齐 / New Flutter behavior not matched | Flutter 当前 HEAD 相比先前 f85477e 新增系统中断、恢复意图及用户取消的处理；Lynx iOS `SongloftAudioEngine.swift` 的 interruption observer 仍只记录日志。不能宣称 iOS 中断恢复已等价。 / Flutter gained interruption/resume cancellation handling; the Lynx iOS observer only logs interruptions and is not equivalent. |

已核对到实际接线：区域聚焦与本机音频分离、队列装载与迟到取消、窄屏队列入口、整数音量、名称缓存刷新、编组主控保留/整组选择、转换调用、休眠、EQ 与响度/交叉淡化、发现/重连/删除、白名单和输出配置。存在实现不等于全部交互与设备行为已验收。

Actual wiring exists for independent zone focus/local playback, queue adoption/cancellation, narrow queue access, integer volume, name refresh, anchored grouping, transfer, sleep, EQ/gain/crossfade, discovery/reconnect/delete and output settings. This does not establish complete interaction or device parity.

验证：`pnpm exec vitest run src/features/output/__tests__ src/features/player/__tests__/player-overlay-back.test.tsx`，5 文件 / 22 项通过；日志 `C:/Users/leon/.local/roomtone-tools/lynx-parity-reaudit-tests.log`。这些测试未覆盖上述面板契约缺口。未重复构建、全套测试、播放试听或原生编译；产品源码本轮未改。

Validation: five test files / 22 tests pass with the command/log above. Existing tests do not cover the panel gaps identified here. Build/full-suite/listening/native checks were not repeated; product source is unchanged in this audit.

2026-10-28，Windows 本机未提交工作树。Lynx 基线 `ab96b325565241cc62850fba01e5efe63385754b`；父仓库基线 `e3809166c665a7b9f478b1bb6d932b52288fee95`。

当前代码指纹（排序后的变更路径与内容，CRLF 统一为 LF）：Lynx 27 文件 SHA-256 `6e309a063bfe4dbbc5b5f2095f44561849edaa508d54e1602616246207798ffa`；父仓库 7 个 Go 文件 SHA-256 `408b0b3b481adb4b05ec04901355c307377588d0cc113ffa9ceb106a61144008`。文档不参与指纹。首次移植全量检查时 Lynx 指纹为 `eea7b975cc439bcc705e59529616dc195b929ae7ede209142f0e59c795e323fe`，之后的界面变更另见下节。

Current code fingerprints (sorted changed paths/content with normalized LF, excluding documentation): Lynx 27 files and parent 7 Go files, hashes above. The initial full-suite snapshot predates the UI refinements below and has the earlier Lynx hash listed above.

## 编组语义与 Roon 结构 / Grouping semantics and Roon layout

按用户提供的 Roon 编组截图重做：当前主控 A 固定在上方的主题色摘要区，不作为可勾选行重复出现。其它区域用方形复选框；已有 B+C 组作为整体加入 A，当前组的非 A 成员可单独取消勾选。取消不写服务器，保存按成员差异修改，A 永不移出；现有“取消编组”入口仅移出 A 之外的成员。保存前重新读取当前组，主控变化则拒绝过期操作，部分失败后刷新真实状态。

Aligned with the user's Roon reference: current anchor A stays in a tinted summary above the checkbox choices. Existing B+C zones join A as a unit; existing non-anchor members can be unchecked individually. Cancel sends no membership changes; Save applies a member diff without removing A. Ungroup removes only non-anchor members. Saving rereads the group, rejects a changed anchor and refreshes state after partial failure.

摘要、标题与保存/取消固定，候选列表独立纵向滚动。离线区域保留名称并标记离线，不再直接过滤；不能精确同步的目标禁选并说明原因。用户报告 Cocoon 缺失后，API 确认其在线且保留原组；实际界面已确认 Cocoon 出现并可勾选，演示后取消，没有保存编组或开始播放。用户已确认滚动恢复。

The summary/header/actions remain fixed while candidates scroll. Offline zones retain names and an offline label; incompatible targets explain why selection is disabled. After the Cocoon report, the API confirmed it online in its original group. Browser inspection confirms it is present/selectable; the demonstration was cancelled without changing membership or starting playback. The user confirmed scrolling works.

验证：新增 3 项当前区域不可移除、整组选择和离线/同步兼容回归；相关 7 文件 / 49 项通过，类型、Lynx/Web 双构建、Go 嵌入构建通过。日志 `lynx-group-design-{types,build,web,tests}.log`，未保存选择的截图 `lynx-parity-evidence/group-editor-selected.png`。未重新跑全套或进行听感/原生测试。

Validation: three new regressions cover anchor retention, whole-zone selection and offline/sync compatibility. Seven affected files / 49 tests, types, dual bundles and embedded Go build pass. Logs and the unsaved-selection screenshot are named above. Full-suite, listening and native tests were not repeated.

## 设备管理界面调整 / Device management refinement

用户要求停止客户端 SDK 安装，两个下载进程已中止，未继续安装或原生编译；暂停试听要求仍有效。重做音箱与区域管理页：设备使用音箱/电脑图标，名称、友好协议和在线状态分层展示，离线排最后；IP、内部协议标识不出现在列表。闹钟、派对和声音设置独立成组，诊断、白名单与网络配置移至高级设置。详情标题使用设备名，提供返回入口；页面切换重新创建滚动容器，避免继承上一页滚动偏移。

The user cancelled client SDK installation; both download processes were interrupted, and no installation/native compilation continued. Playback remains prohibited. The management page now separates device names, friendly protocol labels and online status, uses speaker/computer icons, places offline devices last, and keeps addresses/internal protocol identifiers in details. Playback tools are grouped; diagnostics, allowlist and network configuration live under Advanced. Device details use the device name as title and have a back entry; panel navigation resets the scroll container.

该界面批次：类型与 Lynx/Web 双构建通过，i18n/输入/材质 33 项回归通过；点击目标检查另有 1 项已在基线复现的 Windows 路径失败。实际窄屏确认列表、设备详情、高级设置与返回。日志 `lynx-output-design-{types,build,web,affected,checks}.log`；截图 `lynx-parity-evidence/devices-redesigned-narrow.png`。未重新执行整套测试或播放。

UI validation: types and dual Lynx/Web builds pass; 33 i18n/input/material regressions pass. The tap-target check retains one baseline Windows-path failure. Narrow-screen inspection covers the list, device details, Advanced and back navigation. Logs/screenshots are named above. Full-suite and listening tests were not repeated for this visual batch.

## 功能范围 / Scope

| 功能 / Feature | 实现 / Implementation |
|---|---|
| 区域选择、信号路径、分设备整数音量 / Zones, signal path, integer per-device volume | 根级输出面板，窄屏队列入口 / Root output panels and narrow-screen queue entry |
| 编组、主控、成员排序、延迟及音量偏移 / Groups, leader, ordering, delay and volume offset | 复用服务器区域 API，编组名称展示成员 / Server group APIs and member names |
| 转换播放 / Transfer | 关闭音量面板后展示真实区域；目标播放中提示替换队列 / Replaces volume panel; lists actual groups and warns about replacing an active queue |
| 修改名称、图标、密码、音量模式及上限、接管策略 / Names, icons, password, volume mode/limit, takeover | 区域与设备设置，刷新 Query 缓存 / Group/device settings with Query cache refresh |
| EQ、交叉淡化、ReplayGain、休眠 / EQ, crossfade, ReplayGain, sleep | 使用后端实际能力；未实现的 DSP 不伪装生效 / Real backend processing; no simulated unsupported DSP |
| 闹钟、派对、出口白名单、诊断、自动发现设置 / Alarms, party, allowlist, metrics, discovery settings | 后端 API；测试时不触发闹钟试听 / Server APIs; alarm preview not invoked during muted testing |
| Web 与音箱播放隔离 / Local and remote ownership | 显示 store 与本机音频 store 分离；浏览其它区域不停止本机播放 / Separate display and local engine stores; focus changes do not stop local audio |
| 服务器控制本机播放器 / Server-controlled local player | 票据 WebSocket、完整队列装载、进度上报、迟到装载取消 / Ticket WebSocket, full queue load, reports and stale-load cancellation |
| Android/iOS/HarmonyOS 宿主 / Native hosts | WebSocket 桥接源码已接线；本机缺平台 SDK，平台编译及真机 Not run / Bridges wired in source; platform builds and hardware Not run because SDKs are unavailable |

大队列分批读取歌曲并保留重复条目；本机用户新播放可取消旧服务器装载，但不取消正常后台补队列。音量输入保持整数，直接写后端的数值字段在失焦/确认时提交。

Large queues fetch songs in bounded batches while retaining repeated entries. A new local play supersedes a pending server load without cancelling ordinary background pagination. Displayed volume is integral; directly persisted numeric fields commit on blur/confirm.

## 验证 / Validation

- `pnpm exec tsc -b`、`pnpm run build`、`pnpm run build:web-embedded`：通过 / passed (Lynx + Web bundles).
- 输出 API/运行时/socket、本机播放器、队列导航、返回覆盖层、设置 store 与材质回归：通过；最终命令结果见本机 `C:/Users/leon/.local/roomtone-tools/lynx-parity-*.log` / Output API/runtime/socket and affected regression checks pass; local logs retain command results.
- 最终受影响回归：8 文件 / 168 项通过；全量：353 文件，343 通过 / 10 失败，3714 项通过 / 13 失败。失败名称与隔离基线完全相同，新增失败 0。日志分别为 `lynx-parity-affected-final.log`、`lynx-parity-tests-delivery.log`、`lynx-baseline-failures.log`。 / Final affected checks: 8 files / 168 passed. Full suite: 343 files passed, 10 failed; 3714 tests passed, 13 failed. Failure names exactly match the isolated baseline, with zero new failures; logs are named above.
- 全量测试首轮发现 13 项既有平台/夹具失败；在单独提取的原始 HEAD、相同依赖与换行符下复现：10 文件、13 失败、417 通过。涉及 Windows 路径分隔符、CRLF 源码断言及发布 Markdown 夹具。基线测试配置仅增加临时目录的 Vite 文件读取许可；不修改产品代码。 / Thirteen existing failures reproduce on isolated HEAD with matching dependencies and line endings: 10 files, 13 failed and 417 passed, concerning Windows paths, CRLF assertions and release Markdown fixtures. Only Vite's fixture-directory read allowlist differs in the baseline test configuration.
- Go `test -p 1 ./internal/player/...`、`vet ./internal/app ./internal/player/...` 通过 / passed.
- 实际启动嵌入 Lynx 的 `roomtone.exe`，IAB 窄屏检查区域名、整数音量、转换面板替换、设备与输出配置。截图在 `C:/Users/leon/.local/roomtone-tools/lynx-parity-evidence/`。 / Ran the embedded Lynx executable and inspected narrow-screen names, integer volume, transfer-panel replacement and output settings in IAB; screenshots are in the local evidence directory.
- 用户要求暂停试听：本批不开始播放、不调音箱音量；听感、多房间同步、系统音频焦点及锁屏行为均 Not run。 / User requested no playback: no playback starts or speaker-volume changes; listening, multi-room sync, OS audio focus and lock-screen behavior are Not run.

## iPad 误识别 / iPad false discovery

`_companion-link._tcp` 是配对服务，不能作为 AirPlay 音频输出。服务发现校验服务类型、音频能力位及有效 MAC，显示名称解码 DNS 十进制转义；历史误识别记录不恢复为播放设备，数据库行保留。优先使用解析出的 IP，合并 V1/V2 时保留 IP 并选择正确端口，避免协议去重失效。

Companion-link pairing services are not AirPlay audio outputs. Discovery validates service type, audio capability and MAC identity, decodes DNS decimal escapes, and excludes historical false entries on restore while preserving database rows. Resolved IPs survive V1/V2 merging with the correct service port.

## 交付边界 / Delivery boundary

推送目标为用户仓库 `leonzy/roomtone-player-lynx`；上游远程保留为 `upstream`，父仓库子模块同步指向用户仓库。这些是 Roomtone 专用功能，不推送上游、不创建正式发布。/ Publication targets `leonzy/roomtone-player-lynx`, retaining the original project as `upstream` and pointing the parent submodule to the user repository. These Roomtone-specific changes are not published upstream or released.


## 2026-10-28 · 空队列、转移进度与队列控制 / Empty queues, transfer position and queue controls

- 空区域保留播放条及区域、音量、队列入口；没有歌曲时禁用 transport。/ Empty zones retain the player shell, output/volume/queue entries, with transport disabled.
- 服务器队列装载等待 sourceReady（包含初始 seek）后再播放；装载期间不报告旧进度。本机 sink Open 清除上次会话的位置报告。/ Server adoption waits for sourceReady including initial seek; reports are gated while loading, and the local sink discards previous-session position on Open.
- 区域设备卡增加直接“音量限制”入口；独立面板设置后端 max_volume 硬上限。舒适上限和最小音量尚无后端契约，未声称实现。/ Device cards link directly to the max_volume panel; comfort limits and minimum volume remain unsupported by the backend.
- 队列显示封面、曲名、歌手、时长、剩余数量/总时长；支持移除、确认清空、编辑模式上下移动，以及顺序/列表循环/单曲循环/随机。远程移动使用 queue/reorder，不替换队列、不启动播放。/ Queue rows show artwork, metadata and duration; the header summarizes remaining tracks/time. Remove, confirmed clear, edit-mode move up/down, order/repeat-all/repeat-one/shuffle are exposed. Remote moves use queue/reorder without queue replacement or play commands.
- 验证：相关 TS 48 tests passed，另有播放器/source-load 121 项前批回归通过；Go local sink、AirPlay 编解码及 transfer/max-volume 相关测试通过。Web 双产物、TypeScript 构建通过。未安装客户端 SDK，未发起听音测试。/ Validation: 48 affected TS tests passed, with the earlier 121 player/source-load checks; Go local/AirPlay and transfer/max-volume checks passed. TypeScript and dual bundles built. Native SDK builds and listening tests were not run.
- 噪声仍未定位：检查曲目 54236 的 3 秒 16bit PCM 与 float 参考一致，Web 前 64KiB 与原文件相同，DSP 关闭；这些证据不能证明无可闻噪声，用户尚未进行同曲同设备对比。/ Noise remains unresolved: song 54236's sampled PCM conversion and Web bytes match their source, DSP is disabled; this does not establish audible correctness, and no same-track/device comparison is available yet.

最终部署：leonFN Roomtone `2026-10-28_queue-controls-final`，镜像名仍为 `roomtone:leonfn-20261028`；FN 兼容容器标识保留 songloft。/ Final deployment: leonFN Roomtone `2026-10-28_queue-controls-final`, image `roomtone:leonfn-20261028`; the FN compatibility container identifier remains songloft.


## 2026-10-28 · 播放集合入口全局核对 / Collection action audit

- 首页歌单卡、歌单列表、文件夹（卡片及详情）、分类（卡片及详情）、标签（卡片及详情）统一调用 chooseCollectionPlayback，在根级提供现在播放、随机播放、下一首、加入队列。曲库与歌单详情工具条保留播放主按钮和同一组选项；选中模式只作用于选中歌曲，隐藏曲库歌曲选择器入口。/ Home and playlist cards, folder/facet/tag cards and detail pages share the root collection-action chooser. Library and playlist detail use a primary play button and the same options; selection acts only on selected tracks and hides the library picker entry.
- 现在播放保留首批起播和后台补队列；追加与下一首读取完整分页源，使用 POST queue，并在异步读取前捕获目标区域。随机模式先更新服务器，再走播放路径。/ Immediate playback retains first-page startup and background fill; append/next read the complete paginated source and use POST queue with the destination captured before fetching. Shuffle configures the server before playback.
- 队列图标提供可访问名称；队列根覆盖层在窄屏、宽屏都为播放条留出底部区域。曲目显示歌手与专辑及文件子目录，目录不包含文件名，网络流 URL 不作目录。/ Queue icons keep accessible labels; both root overlay layouts reserve space for the player. Rows show artist/album and containing file directory; stream URLs are not directory labels.
- Windows 工作树 64af28f-dirty-lynx：TypeScript、双产物构建及 13 文件/124 项相关测试通过；Go 队列、repeat/shuffle、transport、排序处理器及播放器测试通过。此次未启动播放。浏览器工具无法可靠识别 Chrome URL 后中止，最终 UI 视觉复验 Not run。/ TypeScript, dual bundles and 124 affected tests in 13 files passed, together with the Go queue/repeat/shuffle/transport/reorder checks. No playback was initiated. Final visual reinspection was not run after browser automation stopped because it could not reliably determine Chrome's URL.
- NAS 当前部署标识为 2026-10-28_collection-options-metadata。容器 roomtone、镜像 roomtone:leonfn-20261028；飞牛包内部 ID Songloft 保留，更新经过 appcenter-cli stop/start。入口标题 Roomtone；桌面图标可见性仍需实际桌面确认。/ The NAS build is 2026-10-28_collection-options-metadata, container roomtone and image roomtone:leonfn-20261028. The internal FN package ID Songloft is retained; updates use appcenter-cli stop/start. Launcher title is Roomtone; desktop-icon visibility remains unverified.


## 2026-10-29 · 集合菜单锚点 / Collection menu anchoring

集合选择器原来未接收触发位置，GlobalMenu 因此使用底部抽屉降级布局。现在卡片、列表行和详情页的播放按钮在点击时测量自身及主题视口，将 AnchorMeasurement 经显式回调参数传到根级菜单。测量不可用时集合菜单使用紧凑浮层降级，不改变其它 GlobalMenu 调用的默认行为。/ The collection chooser previously omitted its trigger measurement, causing GlobalMenu to render its bottom-sheet fallback. Cards, list rows and detail-page buttons now measure themselves and the themed viewport at tap time and explicitly forward AnchorMeasurement to the root chooser. Collections use a compact fallback when measurement is unavailable; other GlobalMenu callers retain their defaults.

72 项相关测试、类型检查及双产物构建通过。实际启动 Windows 程序，在专辑详情点击播放全部，确认菜单位于按钮下方、无整页遮罩、播放条可见；未选择任何播放动作。截图 collection-menu-anchored.png 位于本机证据目录。NAS 构建 2026-10-29_collection-anchored 的前端与本机构建字节一致，应用管理 running。/ 72 affected checks, types and both bundles passed. The running Windows app showed the compact menu below Play all on the album page, without a page-wide dim and with the player visible. No playback action was selected. Evidence is collection-menu-anchored.png. The deployed NAS build 2026-10-29_collection-anchored serves byte-identical frontend files and its app-manager state is running.

用户随后要求清理镜像：NAS 唯一镜像数 12→5，保留三份在用镜像、上一版 Roomtone 与迁移前回退底包；删除 8 个过期标签，builder prune 回收 61.33MB 缓存。/ On the user's cleanup request, NAS image count fell from 12 to 5, retaining the three in-use images, the preceding Roomtone build and the migration rollback base. Eight stale tags were removed; builder prune reclaimed 61.33MB of cache.


## 2026-10-29 · 推送核对与自动换曲 / Push audit and auto advance

用户明确语义：播放全部替换当前区域旧队列并加载整个来源，加入队列才追加；顺序播放默认队列仅显示当前及后续，已播可切换历史查看，整队结束清空待播。循环模式保留曲目。/ Play all replaces the selected zone's queue; append is a separate action. Order-mode queue view shows current/upcoming, with history available separately and pending items cleared at completion. Repeat modes retain their tracks.

音箱自动换曲已修正：连续 PCM 时间轴保持不变，transport 在 queue.Next 后以新 song ID 和曲内位置重新 Load，再发布事件。歌词订阅显示 store，跟随所选区域的曲目及进度；后台本机音频不再拖动远程歌词，远程歌词不写入本机通知/浮动歌词。/ Gapless PCM timing remains continuous, while transport is reloaded with the new track ID and per-track position before its event. Lyrics follow the display store's selected-zone song/time; remote lyrics do not overwrite local notifications or floating lyrics.

验证：Go internal/player/... 全部通过；新 gapless 测试在撤回 transport 重置的隔离 overlay 中按预期失败。Lynx 播放器/输出 77 文件、648 项通过，类型及双产物构建通过。Windows 全量首轮发现的本批新增样式/渲染回归已修正。原基线 ab96b32 的 11 个相关文件在隔离 Windows 副本复现 13 失败/430 通过（基线仅增加 Vite 文件读取允许目录）；平台路径、CRLF、旧发布 Markdown 夹具等既有问题仍未冒充通过。Go handlers 的四项 Windows 假 ffmpeg 夹具失败另行保留。Android/iOS/HarmonyOS SDK 构建和本批听音测试 Not run。/ All Go player packages pass; removing the transport reset in an isolated overlay makes the new gapless regression fail. All 648 player/output checks in 77 files pass, together with types and both bundles. New rendering/style regressions found in the initial full run were fixed. An isolated Windows checkout of ab96b32 reproduces 13 failures and 430 passes in 11 relevant files (only Vite's filesystem allowlist differs). Existing path/CRLF/release-fixture failures and four Windows fake-ffmpeg handler failures are not reported as passing. Native SDK builds and audible testing were not run.
