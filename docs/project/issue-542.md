# #542 · Web 歌单分页与鼠标拖动

目标：[songloft-org/songloft#542](https://github.com/songloft-org/songloft/issues/542)。基线 `81c478c14d67de8a9a9dbbfcc9ab0857e4ee405a`，2026-10-27 的未提交工作树；最终文件指纹和验证汇总存 `/tmp/songloft-542-verification.json`。环境：Linux x86_64、Node 22.17.1、pnpm 11.15.1、Docker Chromium 121。

## 行为与证据

- Flutter 的 `main.dart` 中 `_AppScrollBehavior.dragDevices` 包含 mouse；Lynx Web 只有排序手柄的鼠标捕获，没有普通列表的鼠标拖动滚动。新增 Web 宿主脚本对真实滚动容器实现左键拖动，超过 5px 才捕获，结束拖动后抑制该次点击；普通点击、带标签的操作按钮、编辑框、排序手柄、滑块和触摸保留各自入口。取消、失焦和卸载清理手势。
- `PlaylistDetailPage` 加载下一页时把底部 inset 替换为更矮的 loading footer。本地原实现观察到滚动范围和末尾位置反复相差 32px；修复后 loading 放在同一个固定 inset 内，footer 不使用 Web 的离屏估算。Web 使用实际支持的 `lower-threshold-item-count` 提前预取，原生继续使用像素阈值。
- 滚动位置更新原先会再次调用全部已加载项的 `renderItem`；`VirtualList` 现在缓存未变化的行树。分页时歌曲行也独立 memo，稳定回调通过 ref 读取最新歌曲页和操作，避免旧行持有旧播放队列。选择态、歌曲对象、顺序、分组首字母等实际变化仍更新对应行。
- 隔离旧实现下新增断言共 6 项失败、原有 23 项通过，涵盖缺失的鼠标滚动、宿主打包、80 行重复构造、底部 inset 和分页时旧行重绘。日志 `/tmp/songloft-542-negative-final.log`。初次隔离执行的 Vite 路径错误不作为反向验证证据。
- 界面夹具是立即返回分页的 161 首合成歌单，不访问或修改用户曲库。实际浏览器验证鼠标上拖 320px 后列表偏移为 320，页面仍在歌单；继续分页到第 161 首，菜单可打开且无页面异常。具体日志、截图及最终耗时以验证汇总为准。

## 验证边界

共享 JS、类型、双产物、Web 打包、完整单测和最终浏览器检查的命令与结果见 `/tmp/songloft-542-verification.json`。已知构建输出仍有既有 `touch-action` 编码警告。

- `pnpm test --maxWorkers=4`：350 文件 / 3711 项通过，`/tmp/songloft-542-tests-verified.log`。首次全量发现选择态结构闸门仍引用拆分前的页面路径，更新到实际行组件后全量重跑通过；原始失败保存在 `/tmp/songloft-542-tests-final.log`。
- `pnpm exec tsc -b`、`pnpm run build`（Lynx/Web 双产物）、`pnpm run build:web` 均通过，日志分别为 `/tmp/songloft-542-{types-final,build-final,web-final}.log`。
- 空闲浏览器下，20 首一页的 8 次追加耗时为 309/392/423/464/465/535/558/415ms；最后一页到 161 首，无页面异常。`/tmp/songloft-542-browser-idle.json`、对应 `.png` 和 `/tmp/songloft-542-latency.js` 保留原始测量与脚本。这是夹具结果，未做报告设备上的速度承诺或旧版同条件性能对比。
- Web 触摸滑块回归到 80% 时，续拉 offset 20…120，并停在第 129 首（偏移 8192、滑块 20%），无页面异常；`/tmp/songloft-542-touch.{json,png}`。该检查证明 Web 触摸路径，不替代原生设备。

计时必须在确认新行追加后立刻截止，再独立取截图/可见行证据；逐行读取全部歌曲坐标会强制浏览器布局，不能把该探针的开销称为分页渲染耗时。并发全量测试期间的浏览器耗时也不用于性能结论。

Not run：报告人的 Chromium 150、实际曲库及二进制部署；Android/iOS/HarmonyOS 宿主编译和设备验收（未改宿主）；远端 CI、发布。当前环境没有复现报告人“80 首完全无响应”的全部条件，因此修复已确认的交互缺失、重复更新和高度抖动，不把本地夹具通过等同于报告环境已验收。未提交、推送或评论 Issue。

以上为提交前本地验证快照。后续用户已授权提交、推送、同步父指针并回复 #542；实际提交 SHA、对应 CI 与评论以 GitHub 交付记录为准，正式发布和关闭 Issue 不在授权内。
