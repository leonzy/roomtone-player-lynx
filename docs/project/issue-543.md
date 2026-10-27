# #543 · FN Connect 网关下插件页面无法打开

目标：[songloft-org/songloft#543](https://github.com/songloft-org/songloft/issues/543)。2026-10-27，Lynx 基线 `e1572551b9b6fb584e6a2325ef62e9db103e1283`，父仓库基线 `af5a4b3873ba72e9918ddf661da87ae563448d36`，均加本次未提交工作树。最终源码 SHA-256 与验证汇总：`/tmp/songloft-543/verification.json`。环境：Linux x86_64、Node 22.17.1、pnpm 11.15.1、Docker Chrome 121.0.6167.85。

## 根因与修改

Lynx Web 的 `web/webview-host.js` 为所有插件 iframe 添加 `credentialless`。它创建独立的临时凭证/存储上下文，即使同源也不会沿用原来的 Cookie；Songloft 的 URL token 无法替代 NAS 反向代理自己的登录 Cookie。Flutter 插件 iframe 未设置这个属性。问题发生在浏览器插件宿主链路，无需改各插件或原生客户端。

移除该属性，保留 iframe 常驻、隐藏/恢复、消息来源检查和主题/播放器桥接。选择跨源隔离的宿主继续依赖后端插件 HTML 的 COEP 响应头；该响应头与 iframe 属性语义不同，文档导航和同源资源仍保留 Cookie。旧后端缺头时需升级或关闭可选隔离，不再以丢弃凭证作为兜底。父仓库只更正相关注释，未改响应头或 API。

## 验证

- 新增根路径、子路径、独立后端三项凭证上下文回归，在旧实现下 3 项失败、原有 22 项通过；修复后 25 项通过。日志 `/tmp/songloft-543-negative-unit.log`、`/tmp/songloft-543/unit.log`。
- Docker Chrome 中使用合成 HttpOnly `os-access-code` Cookie 的网关夹具，覆盖桌面外层 iframe、根路径、`/songloft` 前缀、主动隔离的跨源插件。旧脚本三种情况均未带 Cookie，得到 403；新脚本三种情况均正常加载插件 HTML 和带 Cookie 的资源，浏览器正常存储上下文也恢复。`/tmp/songloft-543/browser-result.json` 与 `gateway-requests.jsonl` 保存结果与网关实收证据。夹具模拟认证机制，不代表已登录报告人的飞牛设备。
- `pnpm exec tsc -b`、`pnpm run build`（Lynx/Web 双产物）、`pnpm run build:web`、embedded Go 打包、`pnpm test` 的 350 文件 / 3714 项、`pnpm run test:release` 的 89 项通过。日志位于 `/tmp/songloft-543/`；既有 `touch-action` 编码警告仍在。
- 实际完整版使用临时数据库和上传安装的静态测试插件，经登录 Cookie 网关嵌在桌面式外层 iframe 中，浏览器实际登录并点击插件入口。结果、截图和后端/网关请求证据分别为 `app-browser-summary.json`、`app-browser.png`、`backend.log`、`app-gateway-requests.jsonl`。首次夹具 CSS 使用了错误的非 static 路径，已修正；该次 401 不作为插件资源通过证据。
- 父仓库执行 `gofmt -w .`、`CGO_ENABLED=0 go test -tags dev,lite ./internal/jsplugin`；最终结果见 `verification.json`。父仓库另有并行的 HLS 测试修改，不属于本批次。

Not run：报告人的真实 FN Connect / 飞牛 App、Firefox、Safari；Android/iOS/HarmonyOS 编译和真机（本次只改 Web 宿主）；全量后端测试与远端 CI。未提交、推送、发布或评论 Issue；子模块仍为 dirty，未生成新 gitlink。报告人升级前版本未知，不能据此认定首次受影响版本。

以上为提交前验证快照。用户随后已授权本批提交、推送、同步父仓库指针并回复 Issue；最终提交、同 SHA 的 CI 和评论以 GitHub 交付记录为准，未授权正式发布或关闭 Issue。父仓库并行 HLS 测试修复已独立提交为 `f1d57aee1cc851e237b78b4b3e9d2f14c5f40f51`，本次提交保留它。
