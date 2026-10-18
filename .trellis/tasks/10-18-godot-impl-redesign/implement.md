# 实施计划 W1–W8 · 步骤 / 命令 / 门槛 / 回退

> 2026-10-18 · 供评审。承接关系：W1–W3 → `10-18-godot-domain-foundation`；W4–W7 → `10-18-godot-playable-slice`；W8 → `10-18-godot-validation-release`。**评审通过后**各子任务更新 meta 并 `task.py start` 进入实施（task 创建/方案评审 ≠ 实施授权）。

## 0. 治理与前置

- 前置事实：Godot 4.7.2-stable（W0 锁定）；`GODOT_BIN` 环境变量（默认 `$HOME/Applications/Godot.app/Contents/MacOS/Godot`）；Node/npm 与 P1 脚本可跑；`npm run prototype:freeze -- --check` 基线全绿。
- 分支/提交：沿用仓库现状（基线分支 `codex/initial-import`）；实施提交沿用仓库中文提交习惯，证据文件落对应任务目录（`w*-*.md`）。
- 范围变化即回本任务改文档（Phase 回退规则），不在实施中静默改设计。
- 评审门共五个：① W2 完成（等价证明）② W3 完成（P2 收尾）③ W5 完成（V1 实机移植验收）④ W6 完成（玩法实验报告）⑤ W8（终验收）。

## 1. W1 分层地基与数据合同（P2 · 2–3 人日）

前置：本方案评审通过（评审点零）；W0 证据在位。

步骤：

- [x] 按 design.md §2 建 W1 的 `domain/`、`infrastructure/` 与数据类；W0 冒烟保持全绿。实施细化：`application/` 留给 W3，不建无行为占位类。
- [x] `rng32.gd` 移植（uint32 语义、16 位拆分乘法）＋ `rng_vectors` 套件。
- [x] `canonical_json.gd` 手写写出器 + sha256；`canonical_json` 套件（规格用例 + **content.json 字节等价硬门槛**）。**门槛不过就停下修格式，不得进入 W2（风险 R1）**。
- [x] `state_codec.gd`（GameState ⇄ camelCase Dictionary）＋ `state_codec` 套件（数值整数性/范围/往返/负例）；接收已选 ContentCatalog，不混用版本目录。
- [x] `content_validation.gd` 的 V1 分支 + `scripts/godot-content-validation.mjs` 的版本路由（V1 委托冻结校验器）；`content_validation` 套件（冻结内容 + ≥12 负例）。W1 不提前接纳 V2 扩展。
- [x] `content_loader.gd` + `bootstrap/main.gd` 的 `--verify-content` 启动分支。
- [x] `scripts/godot-sync-content.mjs` + package.json 脚本；首次同步生成 manifest。
- [x] `run_all.gd` 升级为套件 runner（`--suite` 过滤、退出码 0/1/2）；smoke 拆分保留。
- [x] `godot/README.md` 更新命令表与未测项姿态。

2026-10-18 W1 gate 已通过，五套件1975检查、工具8测试、字节等价/漂移/导出自检见 [W1 证据](../10-18-godot-domain-foundation/w1-contracts-evidence.md)。实现随 `eef1920` 提交。

命令：

```bash
npm run godot:sync-content
godot --headless --path godot --editor --quit        # 资源导入
godot --headless --path godot --script res://tests/run_all.gd
# 导出（真实命令沿用 godot/README.md 的 W0 记录）后：
<导出产物>/Contents/MacOS/qingmao-demo -- --verify-content
```

退出标准（W1 gate）：5 个套件全绿；字节等价硬门槛过；`--check` 漂移检测有效（人工改一笔 → 必失败）；导出包内容自检通过。证据：`w1-contracts-evidence.md`（新建于 domain-foundation）。
回退：删除新增文件即回 W0 壳。

## 2. W2 规则等价移植（P2 · 3–5 人日）

前置：W1 gate。

步骤：

- [x] `requirements.gd` / `effects.gd` 逐步移植（顺序敏感点先写单测）。
- [x] `day_cycle.gd`（END_DAY 全序，尤其第 14 日供养后直接开危机，不夜间恢复）、`combat.gd`（含撤退/全危机规则）、危机分支、die/reason 累积。此时只做 V1，D1–D5 留到 W6。
- [x] `queries.gd`：public view / legal actions / 验证文案逐条对照 `engine.ts`。
- [x] `rules_unit` 套件（拒绝无副作用、RNG 不消耗、顺序用例）；补无蛊侦查合法/有蛊侦查不抽风险 RNG、免费移动、最终日不恢复的独立用例，不假设合法黄金轨迹覆盖全部分支。
- [x] `policies/` 三策略移植 + `v1_replay` 套件：seed42 × 3 策略逐步骤全量过。
- [x] `scripts/godot-v1-compare.mjs` + `tests/v1_compare.gd`；`prototype-replay.mjs` 加 `--dump`（仅开发用）。先 `--set development`，后 `--set holdout`。
- [x] 600 局全绿后，把首差定位流程实测一遍（人为制造一次差异 → 走通定位路径 → 复原）。

命令：

```bash
npm run godot:compare -- --set development
npm run godot:compare -- --set holdout
npm run godot:compare -- --set all
```

退出标准（W2 gate · 评审点①）：3 轨迹逐步差异为零；600 局动作序列 + 哈希链全等；rules_unit 全绿；`w2-equivalence-evidence.md` 含命令、耗时、结果、未测项。
回退：按规则组（requirements → day_cycle → combat/crisis → queries）逐组回退；此阶段无 UI 依赖，影响面小。

2026-10-18 W2 gate 已通过：七套件6491检查、3轨迹265动作逐步全状态、600局53042动作/53642状态、工具19测试与macOS包内自检全绿；见 [W2 证据](../10-18-godot-domain-foundation/w2-equivalence-evidence.md)。

## 3. W3 会话、存档与恢复（P2 · 2–3 人日）

前置：W2 gate。

步骤：

- [ ] `session_contracts.gd` + `game_session.gd`（同局去重 64；去重早于 revision；同 ID 异载荷拒绝；重入 busy；过期/超前 revision 都拒绝）。
- [ ] `view_projector.gd`；`save_service.gd`（latest-wins、同物理槽位串行、切局 generation 检查）+ `desktop_save_store.gd` + envelope codec；实现 current/backup 恢复优先级与 tmp 非提交态。
- [ ] `session_semantics` 套件：成功后以原 baseRevision 重试须 dedup，revision/信号/保存次数均只增加一次；缓存淘汰与 UI 旧结果不回退；规则拒绝结果可重放、busy 不缓存。
- [ ] `save_faults` 套件：逐项覆盖 design.md §7 的轮换中断矩阵，含 current 缺失但 backup 有效、恢复失败保留唯一好档、仅 tmp 残留、不同 runId 同槽位迟到写；每个中断点模拟退出重开，另做真实磁盘篡改一例。
- [ ] play 场景接最小 HUD（revision/存档状态/日/生命/元石）作接口演示：证明"后续场景可经冻结接口取状态、提交动作"。
- [ ] Web 导出 + 浏览器实测：保存 → 刷新 → 继续；记录结论或可复现阻断（受限环境走 `probe_capability()` 文案路径）。
- [ ] 会话接口冻结声明写入 `godot/README.md`（含版本化说明）。

命令（完成相应实现后执行，不代表现有入口已通过）：

```bash
godot --headless --path godot --script res://tests/run_all.gd -- --suite=session_semantics
godot --headless --path godot --script res://tests/run_all.gd -- --suite=save_faults
godot --headless --path godot --export-debug "Web" ../artifacts/godot/web/index.html
```

退出标准（W3 gate · 评审点②）：两套件及逐步中断矩阵全绿；四恢复点重载等价；重复命令不重复提交/发信号/保存；Web 结论落盘；接口冻结声明在册。证据：`w3-session-save-evidence.md`。
回退：会话/存档停用、内存运行，游戏逻辑不受影响。

## 4. W4 可玩第 1 日（P3 · 2–3 人日）

前置：P2 在 domain-foundation 归档完成（评审点②通过）。

步骤：

- [ ] `screen_router.gd` + title 实现（新局含种子输入、继续、导入占位、退出）。
- [ ] play 骨架：HUD / 地点视图（参数化三地）/ 行动面板（合法动作来自视图，禁用原因 tooltip）。
- [ ] 事件模态（content-driven）+ 蛊面板 + 暂停（保存/退出）。
- [ ] 日结模态（dayReview）+ END_DAY → 次日流转。
- [ ] 真实输入走查：新局 → 简报/月刃配发 → 劳作/修行 → 日结 → 保存 → 退出 → 继续。

命令：`godot --path godot`，配合真实键鼠走查；自动回归沿用 W1 的全套件命令，不能代替实机证据。

退出标准：真实键鼠完成（无调试注入）；截图/录屏记录；未测项列表。证据：`w4-day1-evidence.md`。
回退：play 退回调试面板驱动。

## 5. W5 完整 V1 可玩闭环（P3 · 3–4 人日）

前置：W4 可玩第 1 日门槛通过。

步骤：

- [ ] 三地点全开；移动/劳作/修行/侦查/调息/采买/装备/封印唤醒/销案全部经 UI 可达。
- [ ] 战斗模态（意图、预测伤害、防御对比、撤退）+ 全部战斗规则走通。
- [ ] 危机两分支（迎战/借势）+ 结局视图（reason 清单 + 统计）。
- [ ] 全部 19 个 V1 事件经通用事件 UI 走通（**不允许逐事件写代码**）。
- [ ] 实机三局：战备成功、借势成功、劳作失败；四个恢复点实机重载。
- [ ] 连点/失焦/重入走查（V7/V8 部分实机化）。

命令：`godot --path godot` 完成三局与重载走查；`godot --headless --path godot --script res://tests/run_all.gd` 检查规则/会话/存档回归。

退出标准（W5 gate · 评审点③ 移植验收）：三局完整打完；重载无重复结算；行动面板与视图一致。证据：`w5-playable-evidence.md`。
回退：按屏幕回退。

## 6. W6 V2 玩法切换与平衡（P3 · 3–5 人日）★ 重设计核心

前置：W5 V1 实机移植验收通过；V1 等价证据与冻结产物不被覆盖。

步骤：

- [ ] 为 Node/Godot 内容校验器添加独立 V2 分支：三元版本路由、新参数/三敌人/next、引擎生成旗标与暴露根节点、保留来源不可伪造；codec 增加按所选目录校验阶段二敌人和盘问暴露的用例。覆盖 contracts.md §7 正反例，V1 继续严格互拒扩展。
- [ ] 编写 `shared/scenarios/qingmao14-v2/content.json`（19 复用 + 9 新增；按 gameplay.md §8/§9；复用事件费用/条件逐项核对 V1，新事件显式写互斥旗标）；Node/Godot V2 校验均通过。
- [ ] 实现 D1–D5 + 扩展 `rules_unit`/`combat_v2`：盘问触发和未了结生成一条持久暴露、庇护公式、D5 turn=0/1 生效而 2/阶段二不生效、预览实伤一致；保留最终日不恢复的 V1 边界。
- [ ] 同步 V2 pack；通过组合根开发启动参数选择 pack，不在 W6 新增 title 控件；确认**未新增界面代码**。
- [ ] 三策略更新为 v2 版本（战备加演武、借势加复核退路、劳作不变）；自冻结 V2 黄金轨迹。
- [ ] 开发集调参（1–100 × 3 策略）达门槛；报告只将实际消耗的非 WORK 日行动计入 ≥9/21；静态验证第 5–13 日全事件、第 7–13 日新增事件窗口覆盖，另附每策略实际机会/门槛/完成或互斥原因矩阵。
- [ ] 消融因果实验（AC4）：分别移除 演武 / 复核退路 / 玉皮+地听草 各一组，报告差异。
- [ ] 登记并首跑留出集 20001–20100（只跑一次，无论结果进报告）。

命令（均为 W1/W6 计划入口，须实施后才可执行）：

```bash
npm run godot:sync-content -- --pack qingmao14-v2
npm run godot:sync-content -- --pack all --check
godot --headless --path godot --script res://tests/run_all.gd -- --suite=content_validation
godot --headless --path godot --script res://tests/run_all.gd -- --suite=state_codec
godot --headless --path godot --script res://tests/run_all.gd -- --suite=rules_unit
godot --headless --path godot --script res://tests/run_all.gd -- --suite=combat_v2
godot --headless --path godot --script res://tests/run_all.gd -- --suite=balance_report
```

退出标准（W6 gate · 评审点④）：dev 门槛达标（战备 ≥70%、借势 ≥70%、劳作 ≤40%、后段实际非劳作日行动 ≥9/21、两段静态窗口覆盖）；双端 V2 schema/codec 与 D1–D5 用例全绿；消融与留出报告齐全；UI 零新增确认。证据：`w6-gameplay-balance-evidence.md` + 报告 JSON。
回退：切回 V1 pack（双 pack 共存即回退开关）。

## 7. W7 体验收敛（P3 · 1–2 人日）

前置：W6 玩法评审点④通过。

步骤：720p/1080p 检查；中文长文滚动；焦点环与键盘全流程；模态打开顺序与关闭焦点恢复；保存失败文案路径；连点/失焦/暂停；单局时长记录（目标 20–35 分钟）；结构化试玩（≥3 人或记录限制）。
命令：`godot --path godot --resolution 1280x720`、`godot --path godot --resolution 1920x1080`；逐窗口检查，不用 headless 结果替代。
退出标准：实际窗口检查表 + 试玩记录；阻断项修复或明确记录。证据：`w7-ux-evidence.md`。
回退：逐项回退样式/文案，不动规则。

## 8. W8 验收交付（P4 · 3–5 人日）

前置：W7 体验收敛与 P3 交接完成，候选的已知限制已登记。

步骤：

- [ ] 候选冻结：规则/内容/工具链哈希登记（contentSha256、Godot 版本串、脚本哈希）。
- [ ] 全量套件 + V1 对照 + V2 报告复跑一遍。
- [ ] macOS 包解压运行 + `--verify-content`；Web 加载/刷新/持久化结论（或阻断）。
- [ ] 填报 AC1–AC10 矩阵（validation.md §3），未测项显式列出。
- [ ] 文档：运行说明、已知限制、复现命令；提交与任务收尾建议。

命令：全量 runner、`npm run godot:compare -- --set all`、`npm run godot:sync-content -- --pack all --check`；双导出沿用 `godot/README.md` 的 `"macOS"`/`"Web"` preset 命令，导出后执行 `-- --verify-content` 和真实包/浏览器走查。V2 留出只复跑已登记且规则/内容哈希不变的集合，不再称为首次盲测。

退出标准（评审点⑤）：AC 矩阵每项有证据或"显式未验证"；用户验收。证据：`w8-acceptance-report.md`。

## 9. 估算与差异

| 包 | 内容 | 人日 |
| --- | --- | --- |
| W1 | 地基/合同/管线/校验/序列化 | 2–3 |
| W2 | 规则等价移植 + 对照工具 | 3–5 |
| W3 | 会话/存档/恢复 | 2–3 |
| **P2 小计** | | **7–11** |
| W4 | 可玩第 1 日 | 2–3 |
| W5 | 完整 V1 闭环 | 3–4 |
| W6 | V2 切换与平衡 | 3–5 |
| W7 | 体验收敛 | 1–2 |
| **P3 小计** | | **9–14** |
| W8 | 验收交付 | 3–5 |
| **合计（剩余）** | | **19–30** |

与旧方案的差异：W1 增"序列化字节等价"硬门槛（+0.5–1）；W6 因 28 事件 + 消融实验扩为 3–5（旧 2–4）；对照机制改哈希链（工具一次投入、复跑便宜）。估算为设计假设，非承诺。
