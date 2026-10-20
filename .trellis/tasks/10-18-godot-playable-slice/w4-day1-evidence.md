# W4 可玩第 1 日证据

日期：2026-10-19 / 2026-10-20（Asia/Shanghai）。源码基线 `ae6dcee`，W4 为工作树改动。
本记录覆盖 W4（可玩第 1 日），不声称 W5 的三地点/19 事件/三局人工试玩完成。

## 1. 环境与不变项

| 项 | 值 |
| --- | --- |
| 引擎 | `4.7.2.stable.official.ed1daf0bf` |
| 主机 | Linux x86_64（补测）；原始 W0–W3 证据来自 Apple M4 / macOS |
| 渲染 | Compatibility / `gl_compatibility`；headless 回归不替代窗口证据 |
| pack | `prototype` |
| scenario / rules / content | `qingmao-fourteen-day-prototype` / `prototype-rules-1` / `prototype-content-1` |
| contentSha256 | `14ad9c82d896da3ebe7d472d7d92f5594f403984c8decaf4e9bf7e477ec9e9f1` |
| 未改动 | TS 规则、冻结内容、黄金夹具、同步副本 |

W3 会话/存档接口保持版本 1：UI 只调用 `new_run/load_run/dispatch/snapshot_view`，
不接触 `GameState`，不在场景里计算规则。

## 2. W4 实现范围

- 标题：uint32 种子输入（长度/字符/范围校验）、继续、退出；导入保持禁用占位。
- HUD：生命/真元/元石/行动/地点/供养/revision；移动、机会、日常行动、补给、物证。
- 事件：通用内容驱动模态（不逐事件写代码），选项禁用原因来自视图。
- 蛊：装备/卸下、封存/唤醒，显示清醒/休眠/封存与每日供养。
- 战斗：敌方意图、预计受击/防御后伤害、7 种行动、意图预览与规则结算一致。
- 日结：账目增量、应付/实付供养、错过窗口、承诺、危机状态。
- 暂停/结局：保存并返回标题、退出、结局 reason 与统计。
- 模态独占：暂停/日结/结局拒绝 HUD 动作；事件/蛊/战斗只接受各自动作；
  Tab 焦点被限制在当前模态内；关闭模态恢复原焦点与世界输入。
- 地点边界：离开学堂关闭说明面板、解除移动锁、隐藏学堂热点并清除悬停提示。

## 3. 自动验证（Linux x86_64）

以下命令退出 0：

```sh
GODOT_BIN=/root/Applications/godot-dl/Godot_v4.7.2-stable_linux.x86_64
"$GODOT_BIN" --headless --path godot --script res://tests/run_all.gd
"$GODOT_BIN" --headless --path godot --script res://tests/play_flow.gd
"$GODOT_BIN" --headless --path godot --script res://tests/title_flow.gd
npm run check
npm run godot:sync-content -- --check
npm run prototype:freeze -- --check
GODOT_BIN=... npm run godot:test-tools
git diff --check
```

| 验证 | 结果 |
| --- | --- |
| 全部 9 套件 | 6761 checks / 0 failures |
| `play_flow` | 90 次场景控件动作（`pressed.emit()`，非真人键鼠）、83 checks / 0 failures；war-ready 从新局走到 `held-the-line` 并存档重载 |
| `title_flow` | 31 checks / 0 failures；非法种子拒绝、合法种子开局、劳作、暂停返回、继续恢复 revision/状态，以及已有存档时新局覆盖二次确认 |
| 模态独占回归 | 暂停/日结期间 `_submit(WORK)` 被拒绝；Tab 不逃出模态 |
| 地点边界回归 | 离开学堂关闭说明面板、解锁角色、隐藏热点、清除提示 |
| Godot 工具测试 | 27/27（含 8 个真实进程中断恢复） |
| React 构建/单测 | 构建通过，295/295 |
| 同步/冻结漂移 | 各 5 文件检查通过 |

## 4. 真实窗口观察

2026-10-19 在 Linux X11（Xvfb 1280×720，Compatibility/llvmpipe）下打开过真实窗口并逐屏截图；
截图留在被忽略的 `artifacts/godot/w4/` 与 `/tmp/qingmao-w4-real/shots/`，覆盖
标题、种子输入、学堂 HUD/行记、地点切换、事件、蛊、日结、暂停与结局。这些截图
拍摄于本轮 review 修复之前。

本轮 review 新增的 720p 会话面板滚动容器和模态输入隔离以 headless 几何/行为回归
验证；会话后段沙箱无法重新建立 X 套接字，因此未重新截图，不能把旧截图当作修复后
窗口证据。模态隔离断言见 `tests/play_flow.gd`，720p 滚动几何见最终运行记录。

未做：W5 的三地点场景化与全部 19 事件、两成功一失败三局人工试玩、720p/1080p
正式验收、导入/导出控件、V2 玩法实验和发行包。自动键鼠输入与截图不等于真人试玩。

## 5. 本轮 review 修复

1. 暂停/日结期间 HUD 仍可通过 Tab/Enter 抢跑提交动作 → 增加模态动作白名单、HUD 焦点禁用；
   回归用例覆盖。
2. 720p 下会话面板内容高度超过视口，底部按钮落在屏幕外 → 改为 `ScrollContainer` +
   `follow_focus`，smoke 路径同步更新。
3. 离开学堂后说明面板不关闭，角色保持 `input_locked` → 位置变化时强制关闭并恢复输入。
4. 客栈/竹林仍绘制学堂热点/悬停提示 → 热点随地点隐藏，位置变化时重建/清除提示。
5. 关闭模态后热点提示不恢复 → 模态关闭显式 `refocus()`。
6. 种子 20 位数字会先触发 `int()` 溢出日志 → 校验有效数字长度再转换；字符改为仅 ASCII 数字。
7. 状态行仍写“架构演示” → 与实际 W4 范围一致。
8. `ImportButton` 缺少唯一名，组合根流程无法断言占位状态 → 补 `unique_name_in_owner`。
9. 战斗行动焦点在上一手不可用时丢失 → 回退到第一个可用行动。
10. 已有存档时单击“开始新局”会直接覆盖进度 → 增加二次确认，未确认不启动新局。
11. 保存失败后返回标题只显示旧 revision → 标题页附带上次保存失败原因，并补充错误码文案。
