# W3 会话、存档与恢复证据

日期：2026-10-19（Asia/Shanghai）。源码基线 `a810e91`，本轮 W3 在其 dirty tree 验证后提交；
实现提交可由本文件所在提交的 `git log` 定位。P2 仍保留 in_progress，等待交接评审，不自动归档。

## 环境与不变项

- Godot `4.7.2.stable.official.ed1daf0bf`；
  `~/Applications/Godot.app/Contents/MacOS/Godot`。
- Apple M4 / macOS，原生 Compatibility / OpenGL 4.1 Metal；
  Web Compatibility / WebGL 2，single-threaded，Emscripten 4.0.20。
- pack `prototype`；scenario `qingmao-fourteen-day-prototype`；
  rules `prototype-rules-1`；content `prototype-content-1`。
- contentSha256 `14ad9c82d896da3ebe7d472d7d92f5594f403984c8decaf4e9bf7e477ec9e9f1`。
- 未改 TS 规则、共享内容、黄金夹具或 Godot 同步副本来隐藏差异。

## 实现及自检修复

GameSession 为唯一状态持有者；64 条不可变去重、过期/超前版本拒绝缓存、同 ID 异载荷拒绝、
真实提交信号重入 busy，以及 new/load 的生命周期锁均落地。形状校验不读取当前 activeEvent，
因此旧 CHOOSE 在另一个事件打开后仍能重放。初始 revision 0 立即入队，确认前 savedRevision=-1；
保存失败不重做动作，不推进已确认版本。新局 runId 不消耗游戏 RNG，跨会话不按种子复用。

SaveEnvelope v1 严格检查字段、版本、内容与正文 SHA256、完整 StateCodec。
DesktopSaveStore 读文件长度后限制 2 MiB，再分配缓冲。SaveService 按进程内物理路径共享锁/代际，
轮换、提升、完成检查代际；重读 tmp/current/恢复文件，并比较预期字节。
坏 current 不覆盖好 backup；只有 tmp 时明确失败并保留文件。标题用 load(false) 只读检查，
继续时才恢复并显示来源/失败原因。接口冻结说明见 `godot/README.md` §7。

## 自动测试

以下命令均退出 0：

```sh
GODOT_BIN="$HOME/Applications/Godot.app/Contents/MacOS/Godot"
"$GODOT_BIN" --headless --path godot --editor --quit
"$GODOT_BIN" --headless --path godot --script res://tests/run_all.gd
GODOT_BIN="$GODOT_BIN" npm run godot:test-tools
npm run check
npm run godot:sync-content -- --check
npm run prototype:freeze -- --check
git diff --check
```

| 验证 | 结果 |
| --- | --- |
| 全部 9 套件 | 6756 checks / 0 failures |
| session_semantics | 126 checks；成功/拒绝重放、缓存淘汰、信号重入、旧事件选择、载入边界、保存版本 |
| save_faults | 130 checks；恢复矩阵、真实磁盘篡改、latest-wins、5 个 I/O 切局点和跨服务同槽位互斥 |
| Godot 工具测试 | 27/27，无跳过；含 8 个真实进程中断恢复用例 |
| React 构建/单测 | 构建通过，295/295 |
| 冻结/同步漂移 | 各 5 文件检查通过，无写入修复 |

真实中断脚本为 `godot/tests/save_interruption.gd`，由 `scripts/tests/godot-save.node.mjs`
为每例创建独立临时目录。先由进程 A 写 revision 0/1，再由 B 在目标点 self-SIGKILL，
最后由全新 C 重启读取并比较完整 body：

| 中断点 | 重启结果 |
| --- | --- |
| tmp 部分写入、flush 后、tmp 重读后 | 原 revision 1；tmp 不提升 |
| 删除旧 backup 后、current 轮换后 | revision 1，必要时从 backup 恢复 |
| 提升前故障、提升后内容损坏 | revision 1，从正式 current/backup 恢复 |
| tmp 已成功提升但尚未回调 | 合法 revision 2，可重新验证并加载 |

四恢复点取自冻结 `war-ready-42`：事件打开、战斗中、日结后、结局。
各点真实磁盘保存后销毁服务，重新创建服务加载并比较所有字段，包含 RNG/log/ledger；
前三点继续下一条黄金动作再次保存，完整状态仍等于冻结期望，无重复结算。
四点的全窗口真人操作留到 W5。

## 原生窗口跨进程

使用 `tests/capture_session.gd`，通过引擎输入事件走 GUI，不直接调用按钮处理器：

```sh
QINGMAO_CAPTURE_MODE=write QINGMAO_CAPTURE_OUT=/tmp/qingmao-w3-native-final \
QINGMAO_CAPTURE_SAVE_ROOT=/tmp/qingmao-w3-native-final/save \
  "$GODOT_BIN" --path godot --script res://tests/capture_session.gd
# 上一进程退出后，同参数将 MODE 改为 continue 再运行
```

新局 → 鼠标劳作 → revision 1 → 返回标题 → 退出进程 → 新进程选择继续。
两次输出 runId `3be54d06964de6ef8e43017a3f0fa101`，
bodySha256 均为 `6b2f953bdd64c299b78587a1dc41722cad1e859bae20ce9597291acabff4fa29`。
1280×720 截图位于 `/tmp/qingmao-w3-native-final/`；HUD 可读、无明显遮挡。
自动输入不称作真人试玩。

## Web 保存、刷新、继续

```sh
"$GODOT_BIN" --headless --path godot --export-debug Web ../artifacts/godot/web/index.html
python3 -m http.server 8173 --bind 127.0.0.1 --directory artifacts/godot/web
npx --yes agent-browser --session qingmao-w3 \
  --profile /tmp/qingmao-w3-browser-profile open http://127.0.0.1:8173
```

agent-browser 0.39.1，HeadlessChrome/155.0.0.0，隔离浏览器配置。导出/页面加载成功，page errors 为空，
控制台没有脚本异常。新局 → 鼠标劳作 → 在 `/userfs` IndexedDB 的 FILE_DATA
直接只读核对 current.json → 刷新页面 → 键盘选择继续，界面恢复 revision 1 / 元石 14：

- runId `f363b4b1f1c4fdbb0c2bfeed3e413fef`；
- bodySha256 `54b17ea3e41dbf60d6daa5d96d55209db7f3d0d81a752a52d27a340631b0d62b`；
- rng 42，rngDraws 0；不是仅内存文件系统写读。
- 截图 `/tmp/qingmao-w3-web-title.png`、`/tmp/qingmao-w3-web-continued.png`；
  最终 HUD 布局重新导出后核对 `/tmp/qingmao-w3-web-final.png`。

## 未测与边界

- 未做 W4/W5 完整事件/战斗 UI、种子输入、导入控件和三路线真人闭环。
- 未实测 Safari、隐私模式、配额耗尽、存储撤权和浏览器强制崩溃的持久化耐久性；
  能力不足分支由 OS.is_userfs_persistent 与探测结果触发，不据正常模式测试推定全部兼容。
- 写锁仅进程内，不承诺多个原生进程或浏览器标签并发编辑同槽位。
- 本轮未重新跑 600 局对照和 macOS 导出；规则/策略未改，沿用 W2 清洁提交对照证据。
- 未运行旧版浏览器 E2E；原先基线差异仍见 P1 记录。
- 未进入 W6–W8，也未据此宣称整体游戏任务完成。
