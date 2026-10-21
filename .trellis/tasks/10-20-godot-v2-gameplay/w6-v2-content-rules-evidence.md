# W6 V2 内容与规则增量证据（第一增量）

日期：2026-10-20（Asia/Shanghai）。基线 `bec3f10`。
本记录只覆盖 V2 内容源、双端版本化校验、同步/加载、StateCodec 与 D1–D5；
平衡调参、留出集首跑、UI 新增不在本轮。

## 1. 版本与内容

| 项 | 值 |
| --- | --- |
| scenarioId | `qingmao-fourteen-day-v2` |
| rulesVersion | `qingmao-rules-2` |
| contentVersion | `qingmao-content-2` |
| 事件 / 敌人 / 参数 | 28 / 3 / 40 |
| contentSha256 | `70c04afba159e88ae7848ec3ca4f972ba3789ddddb176f66e75f70efbc410b0a` |
| 新增参数 | inquiryThreshold、phaseBreatherQi、shelterRouteDiscount、shelterBuyoutMaxGap、shelterBuyoutStonePerPoint、fortifyTurns、fortifyDamageReduction |
| 新增敌人 | `crisis-alpha`；`crisis-pack.next = crisis-alpha` |
| 新增暴露 | `inquiry-unresolved`（仅引擎生成） |
| V1 生成物 | `prototype/content.json`、三个夹具与 manifest 逐字节未变 |

## 2. 双端校验

```sh
node scripts/godot-content-validation.mjs --file shared/prototype/content.json
node scripts/godot-content-validation.mjs --file shared/scenarios/qingmao14-v2/content.json
node scripts/godot-sync-content.mjs --pack all --check
```

- Node `validateGodotContent`：三元组路由；V1 仍委托冻结校验器；V2 先检扩展
  schema，再用 V1 shadow 复用事件图/monotone 审计。
- Godot `ContentValidation`：同一三元组表；V1 分支保持原有 73 checks，V2 分支
  覆盖参数区间、三敌人/next、28 事件、保留旗标与伪造暴露、shadow 审计。
- 负例：V2 配 V1 tuple、缺参、小数、越界、缺阶段敌人、next 未知/成环、
  伪造 `crisis-arrived`/`inquiry-due`/`inquiry-unresolved`、反向 HP。

## 3. 同步、加载与存档

- `godot:sync-content --pack prototype|qingmao14-v2|all [--check]`；`all` 生成
  7 个文件（两 manifest + 5 个 V1 文件）。V1 `--check` 不创建目录、不修复漂移。
- `ContentLoader` 按 pack 读取 manifest：V1 必须 4 条记录（content + 三个夹具），
  V2 必须 1 条 content；`verify_all` 返回两个 pack。
- `StateCodec` 按 catalog 接受 `crisis-alpha`、`inquiry-unresolved`、`inquiry-due`；
  V1 catalog 继续拒绝这三项。V2 state 保存/恢复包含阶段二战斗字段。

## 4. D1–D5

| 规则 | 实现位置 | 验证 |
| --- | --- | --- |
| D1 盘问 | `V1DayCycle.apply` | 阈值前/后、只触发一次、第 14 日未了结生成唯一暴露、已完成不生成 |
| D2 借势 | `V1Effects` shelter 分支 | safe-route 折扣、gap≤2 补钱、ledger、gap 超限转战斗、不误扣 |
| D3 双阶段 | `V1Combat._resolve_defeat` | 阶段切换、喘息封顶、护体清零、turn/药酒连续、终局胜利 |
| D4 先手 | `V1Combat._opening_strike` | 月刃/普攻回退、不占回合、非危机不触发 |
| D5 加固 | `Queries.fortify_reduction` | turn=0/1 生效、turn=2 停止、阶段二/普通战不生效、预览=实伤 |

## 5. 自动验证（Linux x86_64）

```sh
GODOT_BIN=/root/Applications/godot-dl/Godot_v4.7.2-stable_linux.x86_64
"$GODOT_BIN" --headless --path godot --script res://tests/run_all.gd
node --test --test-concurrency=1 scripts/tests/godot-content.node.mjs
node scripts/godot-sync-content.mjs --pack all --check
```

| 验证 | 结果 |
| --- | --- |
| 全部 10 套件 | 6831 checks / 0 failures |
| `state_codec` | 1760 checks；V2 阶段二/盘问暴露往返，V1 拒绝 |
| `content_validation` | 91 checks；双 pack 正例 + V2 负例 |
| `combat_v2` | 43 checks；D1–D5 + V2 动作解码回归 |
| Node 内容工具 | 9 tests：7 pass / 0 fail / 2 skipped（跳过需 GODOT_BIN 的进程级用例） |
| `--pack all --check` | 7 文件一致；V1 生成物 `git diff` 为空 |
| `w6_pack_switch` | 16 checks；`pack_id`/`--pack=` 载入 V2、独立槽位、继续恢复、V2 事件可打开 |
| V2 场景控件流程 | `QINGMAO_FLOW_PACK=qingmao14-v2`：war-ready 90 动作/118 checks、network 95/116、labor 81/116，均 0 失败并到达结局；V1 策略只证明接线，不是 V2 平衡结论 |

## 6. 未做 / 风险

- 未调平衡、未跑开发集 1–100、未登记/首跑留出集 20001–20100。
- V2 场景流程复用 V1 策略，只能证明内容/规则/UI 接线；V2 策略与胜率属于下一增量。
- 已提供开发启动参数 `--pack=qingmao14-v2`（无新增标题控件）；盘问/阶段二的
  专门展示仍属于下一增量。
- V2 数值仍是设计假设；战斗难度、后段非劳作密度与两路线胜率需 W6 后半验证。
- `V1Combat` 仍由脚本名沿用 V1；V2 分支只在 `catalog.is_v2()` 下生效，
  未改 V1 内容/夹具/对照。

## 7. Review 发现与修复

1. **V2 动作全部被拒绝**：`GameAction.decode` 仍硬编码 V1 三元组，导致 V2 界面点击
   返回 `shape-invalid`。改为按 V1/V2 版本表路由，并新增 `combat_v2` 动作解码回归。
2. **V2 无法从组合根启动**：`main.gd` 固定 `load_pack()`。新增 `pack_id` 与
   `--pack=<id>` 开发参数；默认仍为 V1，启动参数与 `--verify-content` 互斥。
3. **README 仍写 V2 留给 W6 / 版本三元组必须匹配 V1**：改为两包版本表与可执行命令。
4. **证据中的 contentSha256 过期**：按最终 canonical 源重新计算为
   `70c04afba159e88ae7848ec3ca4f972ba3789ddddb176f66e75f70efbc410b0a`。

## 8. 平衡与消融（2026-10-21）

开发集（种子 1–100）与本轮唯一一次留出集（20001–20100，运行前登记于
`holdout-registration.md`）使用同一 V2 策略与内容哈希。报告原文在
`artifacts/godot/w6/`（被忽略）。

| 集合 / 策略 | 存活率 | 后段非劳作均值 / 最小值（第 8–14 日） | 平均余石 | 结局 |
| --- | --- | --- | --- | --- |
| dev war-ready | 100/100 | 10 / 10 | 2.0 | held-the-line 100 |
| dev network | 100/100 | 13 / 13 | 14.0 | shelter-secured 100 |
| dev labor | 0/100 | 0 / 0 | 70.0 | overrun 100 |
| holdout war-ready | 100/100 | 10 / 10 | 2.0 | held-the-line 100 |
| holdout network | 100/100 | 13 / 13 | 14.0 | shelter-secured 100 |
| holdout labor | 0/100 | 0 / 0 | 70.0 | overrun 100 |

静态窗口覆盖：第 5–13 日每天至少 1 个事件窗口；第 7–13 日每天至少 1 个新增
事件窗口（报告 `windows` 字段均为 true）。

实机可选机会（每策略每天首次满行动时的 `availableEvents`）已写入报告
`dailyOpportunities`；它证明“窗口内且当前满足公开条件”，不等同于每个事件
都能被同一策略在同一天完成。

### 消融（开发集，只移一项）

| 移除项 | war-ready | network | 结论 |
| --- | --- | --- | --- |
| 无（基线） | 100%，后段 10 | 100%，后段 13 | 基线 |
| 演武 `drilled` | 100%，后段 7 | 100%，后段 13 | war-ready 后段 10→7；network 不受影响，仍可存活 |
| 复核退路 `safe-route` | 100%，后段 10 | **0%**，后段 10 | 借势路线依赖复核退路兑现 |
| 玉皮 + 地听草 `gu` | 100%，后段 2 | **0%**，后段 4 | 有效蛊是两条路线的关键因果 |

`gu` 消融同时移除两类蛊，属于粗粒度因果检查；它不区分玉皮与地听草各自的贡献。
`drilled` 消融对 network 无影响是预期的：network 的固定脚本没有把修为推到演武门槛，
危机战不依赖先手也能借势成功。

### 已知限制

- 复活策略是本轮固定脚本，不是最优策略；100% 存活不等于人类理解或趣味通过。
- 后段非劳作密度只统计真正扣日行动的动作：排除 WORK 与 END_DAY；CHOOSE 按事件
  `actionCost`；其他动作按 `state.actions` 是否减少判断。免费移动/开关事件不计。
  BUY/GU_MODE/REST 等若规则允许且扣行动，则按规则计入。
- 留出集已跑过一次；后续如需修正，旧集作废，使用 30001–30100。
