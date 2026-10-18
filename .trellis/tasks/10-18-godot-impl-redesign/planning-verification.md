# 规划轮验证记录（planning）

> 2026-10-18 · 记录规划初稿与评审修订的检查状态。只验证文档与现有源码事实，不声称新合同已实施；未运行完整产品套件或 Godot 命令。

## 1. 任务创建方式（手工复刻说明）

初稿创建时，Bash 分类器不可用（"auto mode cannot determine the safety of Bash"），create / list / validate 被阻断，因此按 `.trellis/scripts/common/task_store.py::cmd_create` 的字段与目录约定手工落盘，并在父任务的 `children` 中加入本目录。此项保留为历史记录；2026-10-18 本次评审修订已能执行 validate/list，补跑结果见 §3，不再将当时故障描述为当前阻断。

## 2. 本轮交付物

| 文件 | 状态 |
| --- | --- |
| README.md | 已落盘（评审入口） |
| prd.md | 已落盘 |
| gameplay.md | 已修订：V1 事实、盘问后果、回合边界与机会覆盖 |
| design.md | 已落盘 |
| contracts.md | 已修订：行动/kind 数量、会话、存档、版本校验与 D1/D5 |
| implement.md | 已落盘 |
| validation.md | 已落盘 |
| research/design-evidence.md | 已落盘 |
| implement.jsonl / check.jsonl | 已落盘（`{"file","reason"}` 每行一条，格式对照同树任务） |
| planning-verification.md | 本文件 |
| task.json | notes 与 W1–W8 范围说明同步；status/review_status 保持 planning/awaiting-review |

## 3. 已做的检查

| 检查 | 结果与边界 |
| --- | --- |
| `python3 .trellis/scripts/task.py validate 10-18-godot-impl-redesign` | 退出 0；implement.jsonl 8 条、check.jsonl 6 条均通过。该命令只验证上下文清单，不证明玩法/存档实现正确 |
| `python3 .trellis/scripts/task.py list` | 退出 0；完整树共 8 个任务，包含本任务及父子关系 |
| `python3 .trellis/scripts/task.py list --mine` | 退出 0，但过滤列表为空；不据此判断任务丢失，完整树与直接 task.json 核对均存在 |
| Node 内联文档检查（只读） | 9 份 Markdown 的链接目标、表格列数、代码围栏、行末空白；task.json 与 14 条 JSONL 的解析/引用、relatedFiles、双向父子关系、planning 状态均检查 |
| Node 事件表/类型检查（只读） | 28 个事件、9 个新增，复用 ID 与 V1 的 19 个事件一致；第 5–13 日全事件与第 7–13 日新增事件的时间窗覆盖成立；14 种行动、7 种 requirement kind、11 种 effect kind 与 types.ts 一致 |
| 现有 V1 纯函数定点复核 | 无蛊 SCOUT 合法、TRAVEL 不扣行动；V1 校验器仍拒绝新增参数、第三敌人及 next。这验证的是方案引用的既有事实，不是 V2 校验器或 Godot 通过 |
| `git diff --check` + 未跟踪文档空白检查 | 检查跟踪文件及本目录，不能仅靠 git diff 覆盖尚未跟踪的方案 |

首次表格检查发现 design.md 差异表中 `current|backup` 未转义、导致多一列，已拆成两个文件名并复查。父 README/task.json 的原有变更保留，本次只修改本任务目录；未修改产品代码、依赖、冻结夹具或父级已批文档。

## 4. 七项评审问题与修订落点

| 问题 | 修订合同 | 实施与验收承接 |
| --- | --- | --- |
| P1：成功命令重试会先被判过期 | contracts §3 / design §4：runId 后查去重，再检查 revision；异载荷拒绝、重放不再提交/发信号/保存 | W3 / V7，含旧 revision 重试与 UI 不回退 |
| P1：轮换中断后 current 缺失被当无档 | contracts §5 / design §7：缺失也回退 backup；逐步中断矩阵；唯一好档保留；tmp 非提交态 | W3 / V8，每个中断点模拟退出重开 |
| P2：“沿用 V1”却要求侦查必须有蛊 | contracts §2 / gameplay §3：无蛊可冒险、有蛊免风险，TRAVEL 免费，最终日无夜间恢复 | W2 / V6，黄金轨迹外补独立用例 |
| P2：V2 校验扩展只有 next | contracts §7 / design §6：三元版本、参数、敌人、引擎根节点/暴露与 codec 引用；冻结 V1 不放宽 | W1 建 V1 路由，W6 扩 V2；V2/V3 |
| P2：盘问后果缺合同 | D1：危机打开前将已挂起未了结盘问转为唯一暴露，不被疑心衰减清除；影响 readiness 与基础入伤 | W6 rules_unit/combat_v2；V11 |
| P2：前两回合误写成 turn<=2 | D5：0 基 turn=0/1 生效、turn=2 不生效，仅阶段一，预览与实伤共用公式 | W6 combat_v2；V11 |
| P2：第 5、6 日新增事件验收必败 | gameplay §10：第 5–13 日看全事件窗口，第 7–13 日看新增窗口；实际剩余机会另做策略矩阵，免费动作不计行动密度 | W6 / V11；静态覆盖不冒充策略可达或玩法有趣 |

同时校正了复用事件摘要中庇护约定、值夜、囤货的既有费用/条件，以及 kind/action 的数量；没有借本轮修复扩大玩法框架。

## 5. 未做与规范判断

- 本轮在主会话按 trellis-check 清单复核，没有子代理独立复审。
- 未运行 `npm run check`、600 局模拟、留出集或 Godot 测试/导出。文档修订没有新实现可测；七项实际行为须在 W2/W3/W6 按矩阵验证。
- 未将尚未实施的合同写入 `.trellis/spec/` 的“已实现 P1”规范；待对应工作包通过后更新 code-spec，当前详细合同保留在本任务中。
- 未修改 P2/P3/P4 的 `meta.implementation_authorized` 等授权字段——待用户评审通过后按开工流程处理。

## 6. 边界

上述检查发生于规划修订阶段，未启动产品实施。2026-10-18 用户随后明确要求“先提交再按任务开始实施”，已记录评审通过；先提交规划，再激活 `10-18-godot-domain-foundation` 承接 W1。本任务保持 `planning` 作为方案记录；本目录所有"W1–W8 将……/计划新增……"的表述均为计划，不是成果。
