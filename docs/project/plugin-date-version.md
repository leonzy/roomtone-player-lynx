# 四段插件日期版本（2026-10-14）

基线 `9a92929f5f33efdefecc1a01632cb8270ebdc59b` 的 GitHub 发现页使用原生应用的三段比较，四段插件版本返回未知并显示重新安装。普通插件源已有逐段比较。新增插件专用比较接受三/四段、缺少末段视为零，支持 `.9 → .10` 和跨日，保留非法版本为未知；最低宿主版本与原生应用升级规则保持三段。

Linux / Node 22.17.1 / pnpm 11.15.1：`pnpm exec tsc -b`、`pnpm run build`（Lynx/Web）、`pnpm run build:web` 及完整 `pnpm test` **324 文件 / 3498 项**通过。新页面回归要求从已安装 `2026.10.15` 显示更新到 `2026.10.15.1`，确认后发送对应下载地址及覆盖请求。隔离旧源码运行新页面用例 **1 失败 / 14 通过**，目标失败为 Reinstall 缺少更新版本。日志 `/tmp/miot-version-lynx-{types-final,build,web-build,full,old-final}.log`。

Docker Chromium 121.0.6167.85 打开完整生产 Web 产物，从插件商店进入 GitHub 发现，已安装三段版本时显示 `2026.10.15.1` 更新；确认后隔离 HTTP 夹具记录同一版本下载地址及 `overwrite: true`，页面异常为空。GitHub 与安装接口使用夹具，未安装实际插件包；证据 `/tmp/miot-version-lynx-browser.{json,png}`。

Not run：Android/iOS/HarmonyOS 真机及各历史发布客户端；本批只修改插件版本比较和测试，不修改原生宿主或应用版本协议。旧客户端不会因插件 CI 更新而自动获得发现页的新比较逻辑。对应 [English](../en/project/plugin-date-version.md)。
