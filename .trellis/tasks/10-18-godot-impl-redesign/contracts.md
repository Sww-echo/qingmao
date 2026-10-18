# 合同（V2）：规则增量 / 会话 / 存档 / 内容 / 版本

> 2026-10-18 · 供评审。**权威顺序**：V1 共享类型以 `src/game/prototype/types.ts`（已冻结）为唯一权威，本文件与它冲突处以 `types.ts` 为准；本会话新增的会话/存档合同以本文件为准。V2 的规则增量（D1–D5）在 W6 实现时随代码与测试一并冻结。

## 1. 不变更的合同（沿用 V1，逐条列出供核对）

以下 JSON 字段名、大小写和语义在 V2 中保留；敌人 ID 的明确扩展见 D3 与 §7，不得反向放宽 V1：

- 枚举：`LocationId`（academy/inn/bamboo）、`GuId`（moonlight/jade-skin/ear-grass/liquor-worm）、`RelationId`（guard-captain/innkeeper）、`ResourceId`（stones/herbs/wine）、`GuMode`（active/dormant/sealed）、`StrategyId`（war-ready/network/labor）。
- `Requirement` 全部 7 种 kind：`flag`（含 `present:false`，V2 的互斥表达依赖它）、`resource`、`relation`、`cultivation`、`clues`、`gu`（`usable`）、`exposure`。
- `Effect` 全部 11 种 kind：`resource`、`relation`、`clues`、`hp`、`qi`、`suspicion`、`flag`、`gu`、`exposure`、`battle`、`crisis`。
- `PrototypeAction` 全部 14 种 type（见 §2）。
- `PrototypeState` 字段全集（seed/rng/rngDraws 属状态，但**不得**出现在公开视图）。
- V1 敌人 `id: 'scout-wolf' | 'crisis-pack'`；V2 另允许 `crisis-alpha`。意图数组、`rewardStones` 与战斗对象字段保持不变。
- 结局 id：`held-the-line | shelter-secured | overrun | lost-in-bamboo`。

**V2 规则增量不新增任何 requirement/effect/action 种类**——这是本设计对移植风险的核心约束。

## 2. 行动合同（V1 原样沿用）

| type | 附加字段 | 语义（中文标签） |
| --- | --- | --- |
| `TRAVEL` | `location` | 移动，不耗日行动 |
| `OPEN_EVENT` | `eventId` | 打开事件 |
| `CHOOSE` | `choiceId` | 事件选择（费用/效果按定义顺序结算） |
| `DISMISS_EVENT` | — | 收起事件 |
| `WORK` | — | 劳作（+laborIncome 石） |
| `TRAIN` | — | 演武修行（耗真元，涨修为） |
| `SCOUT` | — | 竹林侦查，耗 1 行动和真元；无地听草也可冒险执行，清醒且装备地听草时增加情报并免除随机风险 |
| `REST` | — | 歇息调息 |
| `BUY` | `item: herbs\|wine` | 采买 |
| `EQUIP` | `guId, equipped` | 装备切换（不影响当日义务） |
| `GU_MODE` | `guId, mode: seal\|wake` | 封印 / 唤醒 |
| `CLEAR_EXPOSURE` | `exposureId` | 销案（花元石清暴露） |
| `COMBAT` | `move`（attack/defend/moonlight/jade-skin/herbs/wine/retreat） | 战斗走子 |
| `END_DAY` | — | 结束一天 |

拒绝语义（沿用 V1）：`validate` 失败 → **状态与 RNG 都不动**、无任何副作用；拒绝文案与判定顺序在 W2 逐条对照 `engine.ts` 移植。合法黄金轨迹不覆盖全部拒绝分支，须另补规则负例，含无蛊侦查合法、有蛊侦查不抽风险 RNG、地点/真元不足拒绝。

## 3. 会话命令与结果（本设计新增合同）

```
command  = { commandId: String, runId: String, baseRevision: Int,
             type: "action", action: PrototypeAction }
result   = { ok: Bool, revision: Int, view: View, events: Array,
             error?: { code, message, fieldPath? }, dedup?: Bool }
```

| code | 触发 |
| --- | --- |
| `shape-invalid` | command 缺字段/类型不符（codec 层拒绝，不进 Rules） |
| `run-mismatch` | runId 与当前局不符（旧按钮/旧局迟到命令） |
| `stale-revision` | 未命中去重缓存，且 baseRevision != 当前 revision（过期或超前均拒绝） |
| `busy` | dispatch 重入（信号处理器里再次 dispatch）/ 会话未就绪 |
| `id-reused` | 同 commandId 但载荷不同 |
| `rule-rejected` | Rules.validate 拒绝（内嵌 rules 的 code/message/fieldPath） |

- 检查顺序：形状 → runId → 重入/就绪状态 → 去重 → revision → 规则。先验证 runId，避免跨局命中；**去重必须早于 revision 检查**。
- 去重：当前局最近 64 条已处理命令，以 `(runId, commandId)` 为键，保存规范化载荷 `{baseRevision, type, action}` 与不可变结果副本。同键同载荷直接回放结果并标 `dedup: true`；载荷不同返回 `id-reused`。缓存包含规则/版本拒绝，不缓存临时 `busy`；新局或读档清空缓存。
- 接受命令后顺序固定：`revision += 1` → 写入去重缓存 → `state_committed` → 存档入队。派发锁持续到该序列结束；信号回调重入返回 `busy`。去重命中不再提交、不发提交信号、不再请求保存。
- 重放结果携带原 revision/view；UI 不得用旧结果覆盖较新的视图，最新状态以提交信号或 `snapshot_view()` 为准。缓存淘汰后的旧命令仍因 revision 不匹配而拒绝，不得重新执行。
- 信号：`state_committed(revision, view, events)`、`command_rejected(commandId, error)`、`save_status_changed(status, savedRevision, errorCode)`。

## 4. 视图模型（会话对 UI 的承诺）

- 基础沿用 `PublicPrototypeView`：`state`（**剔除** seed/rng/rngDraws）、`availableEvents`、`legalActions`、`combatForecast`、`maxHp`、`maxQi`、`upkeep`（派生值只走这里，UI 不得自行推算）。
- 会话附加字段：`revision`、`runId`、`saveStatus { state: ok|saving|failed, savedRevision, errorCode? }`、`dayReview?`（END_DAY 后一次的结算明细：账本增量、维持扣费、错过窗口、承诺状态、危机进度提示）、`endingView?`（结局 + reason 清单 + 统计）。
- 视图只读；UI 只渲染视图列出的字段（禁用动作的原因也来自视图，不写死文案）。

## 5. 存档合同（Envelope v1）

```
{
  "formatVersion": 1,
  "scenarioId": "<内容包 scenarioId>",
  "rulesVersion": "<内容包 rulesVersion>",
  "contentVersion": "<内容包 contentVersion>",
  "contentSha256": "<sha256(canonical(content.json))>",
  "body": { "runId": "<String>", "revision": <Int>, "state": { …PrototypeState… } },
  "bodySha256": "<sha256(canonical(body))>"
}
```

- 写入序列与故障语义见 design.md §7；路径 `user://qingmao_strategy_demo/<scenarioId>/<rulesVersion>/current.json|backup.json`。
- 加载条件（全部满足才接受）：读取前限制大小 ≤2 MiB → 结构可解 → 三元版本与当前内容包一致 → `contentSha256` 与当前内容一致 → `bodySha256` 匹配 → state 通过所选版本的 `state_codec` 严格校验（全整数、字段全集、目录引用合法）。不在版本选择前用 V1 敌人枚举拒绝 V2 状态。
- current 缺失、损坏、不兼容或读取失败均尝试 backup；成功回退必须向 UI 报告来源与原因。只有 current/backup/tmp 全部不存在才是“无存档”；存在残留但无可用正式档时明确报错，不自动提升 tmp 或开新局。
- 保存事务的不变量是“提交前最近有效档仍在 current 或 backup 中可恢复”，不是“current 路径始终不变”。轮换/提升/最终校验失败时报告失败，尽力恢复 current；恢复失败也保留有效 backup。新写入确认前不得推进 `savedRevision`。逐步中断矩阵见 design.md §7。
- `body.revision` 即 GameSession 的 revision；加载后会话从该 revision 继续。

## 6. 规则增量 D1–D5（V2 全部规则变化，逐条可测）

**参数化原则**：规则数值放入内容包 `parameters` 或敌人定义；事件条件和费用放在事件自身的 requirements/costs/effects 中，不在引擎写死。新增规则参数的名称、默认假设与边界见 §7，W6 调参不改引擎。

### D1 疑心盘问触发与未了结后果（day_cycle）

- 触发位置：第 1–13 日 END_DAY 的跨日分支，推进日期、关闭旧窗口并恢复后，疑心衰减**之前**，用衰减前数值。第 14 日不再触发新盘问，也不做夜间恢复/衰减。
- 伪码：`if suspicion >= inquiryThreshold(4) and not flags.has('inquiry-due') and not completedEvents.has('inquiry') and not missedEvents.has('inquiry'): flags.push('inquiry-due')`
- 若触发时尚未到盘问窗口（8–14 日），保留旗标，到第 8 日才开放事件；第 13 日晚触发者可在第 14 日白天处理。`inquiry-due` 是引擎保留旗标，内容不可伪造其生产者。
- 盘问事件 `inquiry` 完成后（`completedEvents` 记录）不再触发；错过窗口（`missedEvents`）同样不再复发。
- **未了结后果**：第 14 日 END_DAY 供养后、强制危机打开前，若存在 `inquiry-due` 且 `inquiry` 未完成，使用现有 exposure 形状追加唯一的 `inquiry-unresolved`（source 为“学堂盘问未了结”，day=14），并记 risk 日志。无需新增状态字段或 effect kind。
- 该暴露独立于当前疑心值：即使疑心已衰减到 0，仍保留 1 条痕迹，按既有公式使庇护准备值 −1、危机每次敌方基础伤害 +2；不按疑心点数重复添加。已了结或从未触发者不加。进入危机后不能销案，结局 reasons 明示这条因果。
- 测试点：阈值 3/4、早期挂起/第 8 日开放、第 13 日触发/第 14 日可处理、第 14 日不新触发、只触发一次、错过不复发；两种了结成本与疑心 −6；未了结且疑心为 0 仍留痕、已了结无留痕、只加一条、两类危机公式与读档前后一致。

### D2 危机借势结算（crisis resolution，`response: 'shelter'`）

```
demand     = rng.draw(crisisThreatMin..crisisThreatMax) − (flags.has('safe-route') ? shelterRouteDiscount(1) : 0)
readiness  = clues + relations['guard-captain'] − exposures.size()
readiness >= demand                     → shelter-secured
gap = demand − readiness
gap <= shelterBuyoutMaxGap(2) 且 resources.stones >= shelterBuyoutStonePerPoint(4)*gap
                                        → 扣对应元石（ledger: shelter-buyout），shelter-secured（附"破财"记录）
否则                                     → 沿用 V1 被截路径（伤害 + 转战斗）
```

- 测试点：gap=0/1/2/3、石头不足、`safe-route` 参与抽样后扣减、账本与结束原因记录。

### D3 危机战阶段链（combat，数据驱动）

- 内容增量：敌人定义新增**可选字段 `next: EnemyId`**（V2 仅 `crisis-pack → crisis-alpha` 使用；V1 内容不含该字段，行为不变）。
- 击倒阶段敌人且存在 `next` → **不判胜**：喘息（qi = min(maxQi, qi + phaseBreatherQi(3))）、guard = 0、加载下一敌人（hp 由 rng 抽样）、`turn` 连续累计、记 log（kind: combat）。`herbsUsed/wineUsed` 跨阶段累计（整场共用）。
- 最后一阶段击倒 → 正常胜利流程。
- `combat.enemyId` 语义由"固定二枚举"扩为"目录键（由内容定义约束）"——JSON 形状不变，V1 存档仍可被 V1 内容加载。
- 测试点：阶段切换时点、喘息封顶、护体清零、总回合连续、药酒合计上限、阶段 2 意图循环。

### D4 演武先手（battle start，仅 purpose='crisis'）

- `flags.has('drilled')` → 开场自动一次攻击：月光活跃且真元足够 → `moonlight`，否则 `attack`（走 V1 同一伤害/日志路径）；不额外消耗回合；随后照常进入第 1 回合敌方行动。
- 获取途径：`academy-drill` 事件（需修为 ≥18、3 真元）置 `drilled` 旗标。
- 测试点：有/无 drilled、月光不可用时回退普攻、真元不足时回退。

### D5 加固减伤（combat）

- `turn` 沿用 V1 的 **0 基索引**。purpose='crisis'、enemyId='crisis-pack'、`0 <= turn < fortifyTurns(2)` 且 `flags.has('fortified')` → 敌方入伤 −fortifyDamageReduction(2)（在 V1 伤害流水线的最终入伤处扣减，下限 0；与防御/护体叠加顺序沿 V1）。公开伤害预览使用同一公式。
- 获取途径：`fortify` 事件（8 石 + 1 行动）置 `fortified` 旗标。
- 测试点：turn=0/1 生效、turn=2 不生效；普通战斗不生效；与其他减伤叠加且不为负；阶段二即使 turn 尚小也不生效；预览与实伤一致，保存后边界不重置。

## 7. 内容合同增量（V2 pack）

- 事件从 19 条增至 28 条（新增清单见 gameplay.md §8；未变更文本直接复用 V1）。
- 互斥表达：`final-march` 与 `final-freight` 各自要求对方旗标 `present:false`，在提交选择时先置自身同名旗标；巡山先置旗标再进入战斗，撤退也不解除互斥。
- 新增敌人 `crisis-alpha`；`crisis-pack` 增加 `next: 'crisis-alpha'`。
- **按版本选择严格 schema**：Node 侧计划新增 `scripts/godot-content-validation.mjs::validateGodotContent(content)`，由 scenario/rules/content 三元组选择 V1 或 V2；Godot 的 `content_validation.gd` 使用相同版本表和用例。未知三元组直接拒绝；不得用内容自报的字段绕过版本表。
- V1 分支委托冻结的 `validatePrototypeContent`，Godot 端镜像其规则；不修改 `src/game/prototype/validation.ts`、V1 类型、参数白名单或冻结夹具。W1 只实施 V1 分支，W6 才添加 V2 分支。
- V2 分支保留三地点/四蛊/两关系与现有 kind 的严格校验，明确允许恰好三个敌人（`scout-wolf`、`crisis-pack`、`crisis-alpha`）、下面的参数扩展与可选 `next`。`next` 必须引用存在的敌人、不得成环；本内容包仅允许 `crisis-pack → crisis-alpha`，链上血量区间合法。
- 引擎生成来源：V1 仅 `crisis-arrived`；V2 另有 `inquiry-due`。依赖图和可达性审计将其作为引擎根节点，禁止事件 effects 生成这些保留旗标；其他无生产者的必需旗标仍报错。V2 exposures 必须定义 `unlicensed-survey` 与 `inquiry-unresolved`，后者只由 D1 生成，事件不得伪造。
- `state_codec` 接收已选定的 ContentCatalog，按版本校验 `combat.enemyId`/暴露引用：V2 可恢复 `crisis-alpha` 战斗，V1 仍拒绝第三敌人/新增暴露；不改变存档 JSON 字段形状。
- 数值集中位置为 parameters、敌人或事件定义（gameplay.md §9 为假设清单，W6 校准后冻结）。V2 新增规则参数全部为必填安全整数：

| 参数 | 默认假设 | 合法区间 |
| --- | --- | --- |
| `inquiryThreshold` | 4 | 1–100 |
| `phaseBreatherQi` | 3 | 0–100 |
| `shelterRouteDiscount` | 1 | 0–crisisThreatMin |
| `shelterBuyoutMaxGap` | 2 | 0–2 |
| `shelterBuyoutStonePerPoint` | 4 | 1–100000 |
| `fortifyTurns` | 2 | 0–2 |
| `fortifyDamageReduction` | 2 | 0–100 |

- 双端负例必须包含：V2 三元组配 V1 schema、V1 伪加新增参数/第三敌人/next、缺参/错拼/小数/越界、未知敌人/暴露引用、无生产者旗标、伪造保留来源、next 缺目标/成环。正例包含两包校验与阶段二状态往返；不能只测 next 链。

## 8. 版本与 RNG 合同

| 项 | V1 | V2 |
| --- | --- | --- |
| scenarioId | qingmao-fourteen-day-prototype | qingmao-fourteen-day-v2 |
| rulesVersion | prototype-rules-1 | qingmao-rules-2 |
| contentVersion | prototype-content-1 | qingmao-content-2 |
| 对照要求 | 与 TS 逐步骤等价（W2） | 无等价要求，自冻结 |

- RNG：Mulberry32，state 为 uint32；每局从 seed 初始化；**只在接受路径消耗**；`rngDraws` 计进状态。黄金向量（种子 0/1/12185/4294967295 × 前三次抽取）是 W1 套件的验收依据。
- V2 的 demand 抽样、敌人血量抽样沿用同一 RNG 流与既定消耗顺序，保证"同种子同结果"可回放。
- 存档不跨版本迁移；版本不符明确拒绝（§5）。
