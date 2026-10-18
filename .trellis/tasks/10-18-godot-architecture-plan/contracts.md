# 规则、会话、内容与存档合同

本文件是待实施协议草案；P2 验证后再将已成立的约定写入正式 spec。V1 已有协议以 [prototype-trace-v1](../../../shared/contracts/prototype-trace-v1.md) 为准。

## 1. 规则状态与不变量

V1 逐字段迁移 `PrototypeState`，保持 JSON 字段名，避免对照时另造映射：

| 组 | 字段 |
| --- | --- |
| 身份/随机 | scenarioId、rulesVersion、contentVersion、seed、rng、rngDraws |
| 玩家 | day、actions、location、hp、qi、cultivation、clues、suspicion |
| 经济/能力 | resources、relations、inventory、upkeepDue |
| 进程 | flags、exposures、completedEvents、missedEvents、activeEvent、combat、crisis、ending |
| 可复核记录 | actionCounts、ledger、log |

所有资源、日期、阈值和计数为有限有界整数；uint32 单独检查 0–4294967295。JSON 数字先确认有限、无小数且在该字段范围内，再转换 `int`，不能先截断再检查。布尔值不当作整数。未知字段/类型、缺字段、未知 ID 均报路径和原因。

资源不得负数；生命/真元不超查询上限；蛊模式只接受 active/dormant/sealed；结束态禁止继续规则动作。已完成/错失事件无重复且不冲突；待决事件、combat.purpose、crisis 与 ending 必须满足 V1 实际可达阶段约束。验证器不能自行加一条会拒绝合法历史轨迹的不变量。

apply 不修改输入、Catalog、Action 或先前快照。拒绝返回原状态对象；合法结果使用隔离副本，数组和字典不得共享可变引用。不能用 `Dictionary.duplicate()` 的浅复制冒充完整复制。

## 2. 封闭动作与纯规则 API

以下名称沿用 V1，GDScript 可用类型对象封装，JSON 编解码保持一致。

| 动作 | payload | 提交语义 |
| --- | --- | --- |
| TRAVEL | location | 免费切换地点，待决/战斗时按 V1 禁止 |
| OPEN_EVENT | eventId | 仅打开，校验地点、窗口、条件和行动；不扣选项成本 |
| CHOOSE | choiceId | 再校验 → 扣事件行动和资源 → 完成标记 → 清待决 → 顺序 effects |
| DISMISS_EVENT | 无 | 普通事件暂缓不算完成；危机不可暂缓 |
| WORK / TRAIN / SCOUT / REST / END_DAY | 无 | 费用/地点/状态来自规则，UI 不先扣 |
| BUY | item: herbs/wine | 价格和携带上限来自 Catalog |
| EQUIP | guId、equipped: bool | 装备不清除既有供养义务 |
| GU_MODE | guId、mode: seal/wake | 模式、元石和行动成本只在规则结算 |
| CLEAR_EXPOSURE | exposureId | 有来源的痕迹，实际代价处理 |
| COMBAT | move | attack/defend/moonlight/jade-skin/herbs/wine/retreat |

不接受任意字段透传。正式应用没有 SET_RESOURCE、跳日或强制结局动作；测试构造状态与正式动作解码隔离。

计划 API（签名表达责任，不保证当前可编译）：

```text
Rules.create(seed, catalog) -> GameState
Rules.validate(state, action, catalog) -> ValidationResult
Rules.apply(state, action, catalog) -> RuleResult
Queries.public_view(state, catalog) -> PublicView
Queries.preview(state, action, catalog) -> ActionPreview
```

`ValidationResult = {ok, code, message, fieldPath?}`；`RuleResult = {accepted, state, error?, events[]}`。error code 稳定，不以中文字符串做分支判断。状态中 V1 的确定性中文日志原样保留，结构化事件放结果外层，不替换日志或重复写账。

查询只读、无 RNG、无文件/时间依赖。`ActionPreview` 包含 action、expectedRevision、确定成本、可见收益/区间、要求、拒绝原因、已知危险及未知说明。不能为显示预览提前 apply、抽样，再把抽样结果藏起来。

## 3. 会话命令、ViewModel 与信号

```text
Command = {runId, commandId, expectedRevision, action}
DispatchResult = {accepted, revision, code?, message?, commandId}
```

- `runId` 每次新局生成；`revision` 从 0 起，合法状态变更加一并持久化，查询/拒绝不加。
- 同 commandId 同 payload 的重复请求返回既有结果，不再 apply/保存；同 ID 不同 payload 报冲突。首版使用有界最近命令缓存，超出缓存的旧请求仍会被 expectedRevision 拒绝。
- expectedRevision 与当前不同则 `STALE_COMMAND`，刷新预览再由玩家选择；不自动把旧点击套到新事件。
- 重入/同时提交返回 `BUSY`；不排队执行过期点击。输入锁和 revision 两层保护，不能只给按钮加 debounce。
- 会话向 UI 返回不可变副本/投影；UI 不接触内部 `_state`。存档安装和新局安装均使旧屏幕命令失效。

| ViewModel | 主要字段 |
| --- | --- |
| HudView | day、actions、hp/maxHp、qi/maxQi、stones、upkeep、保存状态 |
| LocationView | locationId、可交互 targetId、当前已知机会、地点转换合法性 |
| EventView | eventId、标题/正文、窗口、choiceId、各选项成本/条件/风险/禁用原因 |
| GuView | 拥有、装备、mode、可用原因、今晚义务、封存/唤醒预览 |
| PreparationView | 已知危机目标、已落实准备、缺少条件、机会期限；不下唯一最优指令 |
| CombatView | 敌人生命/意图、可见伤害预览、真元/补给、合法招式及撤退代价 |
| DayReview / EndingView | 实际账本变化、供养/休眠、错失窗口、结局原因；不用预期文案冒充实际消耗 |

计划应用信号：`state_committed(revision, view, events)`、`command_rejected(commandId, code, message)`、`save_status_changed(runId, savedRevision, status, error)`、`session_replaced(runId, revision, view)`。

规则结果事件最小集合：资源变化、事件完成、蛊状态变化、日结、战斗开始/回合/结束、危机到达、结局。事件有稳定类型及 action 内序号，应用包装 `runId/revision/index`。同一事件重复呈现不得重新结算；读档只重建当前界面，不重放收益。事件不是第二份状态存储，也不为首版引入 event sourcing。

## 4. 结算顺序与恢复点

V1 移植严格保持当前 engine 行为，以下是易错点而非新设计：

1. CHOOSE 按成本与 effects 数组顺序执行。先记录已完成且清 activeEvent，效果可进入战斗或直接结局。
2. END_DAY 先计算包括 `upkeepDue` 的义务；足额扣元石，否则本次不部分扣款，未封存蛊休眠。
3. 第 14 日在这次供养后进入 crisis=decision、activeEvent=crisis-arrival；不再先恢复真元/生命、递增日期或开放额外筹备。
4. 非最后一天再递增日期、关闭到期事件、重置行动、夜间恢复和关注衰减、建立次日义务；暴露不因衰减消失。
5. 战斗回合不再扣日程行动；敌意图、补给本场次数、撤退损失、胜利奖励和 RNG 顺序全部对照 V1。

没有可保存的“扣一半费用”“供养一半”“动画还没发奖励”状态。domain 一次动作完成后才能提交快照。日结回顾暂停在 UI 上时，保存的已是日结后完整状态；读档展示当前日/危机，不再执行日结。

## 5. RNG 和跨引擎对照

- 复现现有 Mulberry32，保存 rng 和 rngDraws。不能改用 Godot RandomNumberGenerator，即使 seed 相同。
- GDScript 用非负掩码值模拟 JS 逻辑右移；低 32 位乘法优先用 16 位分段，避免直接 uint32×uint32 超过有符号 int64。每一步截断位置与 TS 一致。
- 校验样本的 32 位分子及抽样顺序，再除以 2^32 取值；范围选择保留 V1 的 floor 和包含上界逻辑。

| seed | 前三次样本分子 |
| --- | --- |
| 0 | 1144304738, 1416247, 958946056 |
| 1 | 2693262067, 11749833, 2265367787 |
| 12185 | 2499861155, 1810223824, 1374101062 |
| 4294967295 | 3850105811, 813802916, 3073704848 |

P2 对照 **整个 V1 State，包括 log、ledger、actionCounts**，只排除新应用 envelope 与 UI 状态；不采用此前高层方案中未定义的缩减投影。对象键排序、数组原顺序、UTF-8、两空格和末尾换行沿用既有合同。输出第一个不一致的 step、action 和 JSON 路径，非零退出。

三份 seed42 黄金轨迹先通过，再用现有开发/保留集全部 600 局动作对照。重复跑既有 V1 保留集属于移植回归，不再称“首次盲测”。V2 改规则后另冻结新夹具和未用于调参的种子集合。

## 6. 内容合同与唯一权威

沿用 V1 的 scenarioId/rulesVersion/contentVersion、parameters、locations、gu、relations、exposures、enemies、events。字段精确定义以现有 `types.ts` 为来源；移植不自由改名。

| 内容 | 必查内容 |
| --- | --- |
| parameters | 必需键、有限整数、非负/正数约束、容量/日期范围相容 |
| locations/gu/relations/enemies | 唯一稳定 ID；显示名称非逻辑键；战斗范围和成本合法 |
| events | 地点、含首尾的日期窗口、actionCost、至少一个可处理选项、引用有效 |
| requirements | flag/resource/relation/cultivation/clues/gu/exposure 的封闭字段集合 |
| effects | resource/relation/clues/hp/qi/suspicion/flag/gu/exposure/battle/crisis 的封闭字段集合 |
| 图与固定节点 | 必需危机节点/可应对兜底存在；依赖可达；可选分支不误当全部强制依赖 |

生成脚本校验源→规范 JSON→manifest/hash→同步到 `godot/content/generated/`。Godot 启动也校验实际资源；导出 preset 明确包含 JSON/字体，不依赖编辑器里可读就假定导出可读。校验副本漂移不能悄悄覆盖源。V1/V2 源切换见 [migration.md](migration.md)。

版本策略：外层 schema 变化升 formatVersion；规则含义、费用/伤害/窗口等结果变化升 rulesVersion，并按内容变更升 contentVersion；纯文案/图像显示变更升 contentVersion，不冒充相同内容哈希。首版仅接受已明确支持的精确组合，不静默跨版本加载。

## 7. 新存档格式与故障语义

提议独立根目录 `user://qingmao_strategy_demo/`，按 scenario/rules 组合分槽，单局当前档 + 上一份有效备份；首版不做多角色档案管理。v2 浏览器档和新格式无共用 key 或路径。

```text
SaveEnvelope = {
  formatVersion: 1,
  scenarioId, rulesVersion, contentVersion, contentSha256,
  body: {runId, revision, state},
  bodySha256
}
```

body 摘要覆盖规范化字节；版本头与 state 中版本必须逐项相同，并匹配当前 Catalog。校验和用于发现损坏，不宣称防修改。保存时间可作为显示元数据另加，但不参与规则/RNG，不以文件 mtime 判定哪份状态正确。

保存队列只有一个写入者：每次 accepted 都请求不可变快照，可合并尚未写的旧 revision，正在写的任务不可被下一份覆盖；最后明确报告落盘 revision。不同 runId 的迟到回调不得把新局显示成“已保存”。保存不成功时 retained memory revision > savedRevision，重试同一或更新完整快照，不重新执行动作。

桌面写入：序列化并自校验 → 写临时文件/flush，检查可取得的IO错误并关闭 → 重读校验 → 将有效旧 current 保留为 backup → 替换 current → 重新读取确认成功。每步错误保留最近有效档；具体 rename/覆盖能力必须在选定版本与平台故障演练，不把流程图当原子性证明。

| 故障/候选 | 行为 |
| --- | --- |
| current 有效 | 正常继续，忽略未完成 tmp；backup 保留 |
| current 损坏、backup 有效 | 显示“主档损坏，可恢复上一份”及进度；选择后一次安装；保留损坏件，不直接覆盖备份 |
| 两份均损坏/版本不兼容 | 明确原因、导入或返回标题；不默认新局覆盖 |
| 磁盘满/无权限/替换失败 | 内存可继续，显示未保存与重试/导出；保留可用旧档 |
| 导入非法、旧 v2、其他 scenario | 不改变当前会话、不改原文件；解释格式不支持或具体字段错误 |
| 保存时进程退出/遗留 tmp | 下次按完整校验选 current/backup，不按 tmp 较新自动晋升 |

加载先在隔离候选上做字节大小限制、JSON/版本/内容/字段/引用/阶段不变量校验，全部成功才替换。必须覆盖 activeEvent、巡逻战斗中、最终战中、日结后和 ending。首版不证明任意导入状态在全部历史中可达，但不能接受矛盾或越界字段。

Web 适配沿用同一 envelope，不宣称桌面 rename/flush 等于浏览器持久化完成。早期导出验证中实测该版本文件系统同步机制、刷新/关闭后恢复、存储拒绝与配额错误；不能确认持久化时显示“本次会话/导出文件”，不显示已持久保存。用文件导入导出提供可带走备份。Web 阻断不阻止桌面验收，但必须给出复现和范围限制。
