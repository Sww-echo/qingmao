# W5 三地点可玩闭环证据（第一增量）

日期：2026-10-20（Asia/Shanghai）。基线 `a6c7163`（W4 与工具修复已推送）。
本记录覆盖 W5 的**第一增量**：三地点场景切换、安全出生点、关系/风险 HUD、
三策略场景驱动整局。尚不把 W5 gate 标为通过。

## 1. 本轮实现

- 学堂、客栈、竹林各自拥有世界几何：讲堂/演武场/灵田、柜台/客房/院落、
  林缘/小径/旧巢。几何仅表现地点，不持有规则状态。
- `TRAVEL` 成功后由视图驱动地点切换，并把玩家放到该地点安全出生点
  （`LOCATION_SPAWNS`）；读档回到地点后同样按地点出生。
- 每地点新增稳定热点（`academy.*`、`inn.*`、`bamboo.*`）；非当前地点的热点
  由 `InteractionController` 过滤，不能聚焦、不能点击、不能触发 E。
- HUD 新增只读关系/风险行：巡山队长、客栈掌柜、嫌疑、暴露数量；数值直接来自
  `view.state`，界面不计算规则。
- 离开任一地点会关闭说明面板、解锁角色、清除提示；关闭模态后重建热点提示。
- 说明面板记录打开时的地点；只有回到该地点才允许继续显示，避免跨地点残留。
- 交互控制器按可见性过滤热点，而不是依赖角色进入/离开信号；隐藏热点不能聚焦、
  点击或用 E 触发。

## 2. 自动验证（Linux x86_64）

```sh
GODOT_BIN=/root/Applications/godot-dl/Godot_v4.7.2-stable_linux.x86_64
"$GODOT_BIN" --headless --path godot --script res://tests/run_all.gd
QINGMAO_FLOW_STRATEGY=war-ready "$GODOT_BIN" --headless --path godot --script res://tests/play_flow.gd
QINGMAO_FLOW_STRATEGY=network   "$GODOT_BIN" --headless --path godot --script res://tests/play_flow.gd
QINGMAO_FLOW_STRATEGY=labor     "$GODOT_BIN" --headless --path godot --script res://tests/play_flow.gd
"$GODOT_BIN" --headless --path godot --script res://tests/title_flow.gd
"$GODOT_BIN" --headless --path godot --script res://tests/reload_flow.gd
```

| 验证 | 结果 |
| --- | --- |
| 全部 9 套件 | 6761 checks / 0 failures |
| `play_flow` war-ready | 90 次控件动作、120 checks / 0 failures；`held-the-line` 存活 |
| `play_flow` network | 94 次控件动作、118 checks / 0 failures；`shelter-secured` 存活 |
| `play_flow` labor | 81 次控件动作、118 checks / 0 failures；`overrun` 失败 |
| `title_flow` | 31 checks / 0 failures |
| 三地点场景 | 每地点几何/热点随 `TRAVEL` 切换；玩家落在安全出生点 |
| 热点可达 | 学堂 3、客栈 2、竹林 3；非当前地点热点不可交互 |
| 关系 HUD | 巡山队长/客栈掌柜/嫌疑/暴露与 `view.state` 一致 |
| 恢复点渲染 | 事件/战斗/日结/结局各载入新会话：modal 由状态恢复，日结不重放账目，战斗七种行动与意图可见 |
| 720p 布局 | 会话面板、滚动容器、结束此日按钮、行记均在视口内 |

`play_flow` 通过 `pressed.emit()` 驱动真实控件，但仍不是真人键鼠试玩。

## 3. 内容覆盖

19 个 V1 事件按地点分布为：学堂 9、客栈 7、竹林 3。三条 seed42 策略合计经
`OPEN_EVENT` 打开 18 个事件；第 19 个 `crisis-arrival` 由第 14 日日结自动进入，
随后通过 CHOOSE 结算，因此也在实局路径内。事件 UI 仍为内容驱动，没有逐事件写代码。

## 4. 尚未完成（W5 gate 剩余）

- 真人键鼠完成战备成功、借势成功、劳作失败三局并记录；当前为场景控件自动驱动。
- 事件中/战斗中/日结后的**窗口级进程**重开与实机走查；UI 级四恢复点已由
  `tests/reload_flow.gd` 覆盖，W3 `save_faults` 覆盖规则/存档接口。
- 本轮沙箱无法新建 X 套接字（Xvfb bind 失败），修复后的窗口截图与真人键鼠三局待补；
  `tests/capture_w5.gd` 已准备好，可在有真实显示的环境直接产出三地点/模态截图。
- 720p/1080p 修复后窗口截图（当前截图早于 W4 review 修复）。
- 连点/失焦/重入的实机走查。
- W5 gate 评审与 `w5-playable-evidence.md` 的最终版本。

## 5. 明确不在本增量

原著章节复刻、唯一解、隐藏好感度、完整 165 日、正式美术、V2 玩法实验。
`蛊真人.txt` 仅作本地核对资料，不进入游戏内容，也不存在按原著经历判定死亡的逻辑。

## 6. 代码 review（2026-10-20）

本轮在 W5 提交后做了第二轮独立阅读与针对性探针，不把实现阶段的自我检查当作 review。

发现并修复：

1. `_render` 先 `refocus()` 再应用地点几何/出生点，导致切换地点瞬间可能基于旧热点显示提示；
   调整为先应用地点视觉与出生点，再重建焦点。
2. `capture_w5.gd` 在旧 Play 场景仍在树中时加载状态模态，两张 CanvasLayer 会重叠；
   截图前先释放旧屏幕。
3. `godot:compare` 版本校验失败文案在沙箱 EPERM 下打印 `exit undefined`；
   改为保留实际错误/空输出信息。
4. `play_flow.gd` 结尾重复的 ending 断言块合并，避免维护两份同义检查。

复核后：9 套件 6761 检查、war-ready 120、network 118、labor 118、reload 27、
title 31 均 0 失败；`QINGMAO_FLOW_STRATEGY` 路径与 720p 布局回归通过。

仍保留的 review 备注（未在本轮改）：

- `SaveService.flush_pending()` 失败后不恢复 `_pending`；当前会明确报错并在标题显示
  “上次保存失败”，但内存中的待写快照会被丢弃。修复涉及存档重试语义与故障用例，
  应在 W7/V2 前单独评审，不在 W5 静默改合同。
- `play_flow` 仍通过 `pressed.emit()` 驱动控件；这是自动化，不是真人键鼠验收。
- 沙箱无法新建 X 套接字，修复后的窗口截图与真人三局仍待补。
