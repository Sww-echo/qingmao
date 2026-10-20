# V2 技术设计

## 1. 版本路由

| 版本 | scenarioId | rulesVersion | contentVersion |
| --- | --- | --- | --- |
| V1 | `qingmao-fourteen-day-prototype` | `prototype-rules-1` | `prototype-content-1` |
| V2 | `qingmao-fourteen-day-v2` | `qingmao-rules-2` | `qingmao-content-2` |

- 路由只看三元组，不看内容自报字段；未知组合直接拒绝。
- V1 分支不改冻结校验器/类型/夹具；V2 分支在 `scripts/godot-content-validation.mjs`
  与 `godot/domain/content_validation.gd` 各实现一份，规则与负例对齐。
- 生成物：`godot/content/generated/prototype/*` 与
  `godot/content/generated/qingmao14-v2/*`；两者都只由 sync 写入。

## 2. V2 schema 增量

- `parameters` = V1 33 项 + `inquiryThreshold`、`phaseBreatherQi`、
  `shelterRouteDiscount`、`shelterBuyoutMaxGap`、`shelterBuyoutStonePerPoint`、
  `fortifyTurns`、`fortifyDamageReduction`；全部必填安全整数并检查区间。
- 敌人恰好 3 个；`crisis-pack.next = crisis-alpha`，`next` 必须存在、不得成环，
  仅允许该链；`crisis-alpha` 无后继。
- exposures 必须含 `unlicensed-survey` 与 `inquiry-unresolved`；
  `inquiry-unresolved` 禁止由事件 effects 生成。
- 保留旗标：`crisis-arrived`、`inquiry-due`；后者为 V2 引擎根节点。
- 事件 28 个；`final-march`/`final-freight` 用对方 `present:false` 互斥。
- 复用 V1 的 requirement/effect/action 种类，不新增语义。

## 3. 规则增量

- D1 在 `V1DayCycle.apply` 的 V2 分支：
  第 1–13 日先挂 `inquiry-due`（衰减前疑心 ≥ 阈值），再衰减；
  第 14 日供养后、开危机前把未了结盘问转成唯一 `inquiry-unresolved`。
- D2 在 `V1Effects` 的 shelter 分支：需求减 `safe-route` 折扣；
  缺口 ≤ 上限且付得起则扣石（ledger `shelter-buyout`）后成功。
- D3 在 `V1Combat` 击倒阶段敌人时读取 `next`：
  不判胜，回气 `phaseBreatherQi`、清护体、加载下一阶段、保留 turn/药酒计数。
- D4 在 `start_battle(purpose=crisis)` 后按 `drilled` 自动打一次；
  月光可用且真元足够用月刃，否则普攻；不额外消耗回合。
- D5 在 `Queries.combat_forecast` 与敌方伤害结算共用同一公式：
  `purpose=crisis && enemy=crisis-pack && turn<fortifyTurns && fortified`
  → 入伤减 `fortifyDamageReduction`，下限 0；阶段二不生效。

## 4. 兼容与回退

- V1 路径以 `parameters.has(...)`/版本判断显式分流；缺参时行为与旧版逐字节一致。
- 出问题按 pack 回退：删除 `content/generated/qingmao14-v2` 并让启动参数回到
  `prototype`，V1 不受影响。
- 不迁移旧档；V1/V2 槽位由 scenario+rules 版本天然隔离。
