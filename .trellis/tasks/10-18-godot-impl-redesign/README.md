# Godot 详细实现方案与玩法重设计 · 评审入口

2026-10-18 · **方案已评审通过**。用户要求“先提交再按任务开始实施”；本目录保留规划记录，产品实施由承接子任务按 W1–W8 顺序推进。

按用户要求创建：以本会话对仓库、P1 冻结事实与 W0 证据的理解，把 Godot 重构的实现方案**重新设计一版**——更细（W1–W8 全程覆盖，P2 深写到文件/接口/命令级），玩法**允许重新设计**（保留用户已确认框架）。本目录只产出方案文档，不改任何产品代码。

## 阅读顺序

| 文档 | 回答的问题 |
| --- | --- |
| [prd.md](prd.md) | 本次重设计的范围、需求与"对计划本身"的验收 |
| [gameplay.md](gameplay.md) | 玩法 v2：三幕节奏、系统重设计、完整事件表、平衡目标 |
| [design.md](design.md) | 技术设计：分层、目录、接口、内容管线、存档、测试与工具链 |
| [contracts.md](contracts.md) | V2 规则/会话/存档/内容合同与规则增量 D1–D5 |
| [implement.md](implement.md) | W1–W8 执行计划：步骤、命令、退出标准、回退点、估算 |
| [validation.md](validation.md) | 验证矩阵 V0–V14 与父标准 AC1–AC10 的映射 |
| [research/design-evidence.md](research/design-evidence.md) | 本方案的证据索引（源码路径与既有证据出处） |

## 核心决策

- **骨架不变、细节重写**：保留父计划已批的四层划分、"先 V1 等价移植、再玩法演进"、独立存档、macOS+Web 双导出；本方案把 W1 起细化为文件/接口/命令级设计。
- **玩法 v2（用户授权重设计）**：在保留十四日/三地点/四蛊/两策略框架下重构节奏——三幕推进，每天有真实选择；新增修为门槛（演武先手）、疑心盘问、双阶段危机战、庇护缺口可用元石补齐（≤2 点）、后段资金用途（加固/年市/末段差事二选一）。
- **对照机制细化**：3 条黄金轨迹逐步骤全量比对 + 600 局每步哈希链比对（Node 产期望、Godot 重放）；规范化 JSON 字节等价列为 W1 硬门槛。
- **规则增量最小化**：V2 仅 5 条规则语义变化（D1–D5，见 contracts.md），不新增 requirement/effect 种类；内容保持纯数据。
- **实施承接**：W1–W3 → `10-18-godot-domain-foundation`；W4–W7 → `10-18-godot-playable-slice`；W8 → `10-18-godot-validation-release`。评审通过后由对应任务进入实施。

## 评审修订（2026-10-18）

已按“修复必要的问题”修订七项：命令先去重再检查 revision；current/backup 轮换中断恢复；V1 无蛊侦查等语义校正；V2 完整版本化校验；盘问未了结转一条持久暴露；加固采用 0 基前两回合；区分全事件与新增事件的窗口覆盖。实施步骤与验证矩阵同步，详见 [planning-verification.md](planning-verification.md)。

规划修订之后，用户已明确批准按任务开工；版本化校验器、存档事务和新玩法尚待各工作包实施，不将批准视为实现证据。

## 与已批方案的关系

`10-18-godot-architecture-plan`（已批）与父任务文档仍是基线；本方案在 **W1 起的实现细节与玩法描述**上细化/修订（差异清单见 [design.md](design.md) §11）。现已评审通过，冲突处以本方案为准。

## 现状边界（不要误读）

- W0 已交付：Godot 4.7.2-stable 锁定、原生壳窗口、36/36 冒烟、macOS/Web 最小导出（证据：`../10-18-godot-domain-foundation/w0-toolchain-evidence.md`）。
- W1/W2 已由 P2 承接完成：数据合同、RNG/规范 JSON、codec、严格 V1 校验、纯规则、三策略与跨引擎对照，见 [W1 证据](../10-18-godot-domain-foundation/w1-contracts-evidence.md) 和 [W2 证据](../10-18-godot-domain-foundation/w2-equivalence-evidence.md)；实施改动尚未提交。
- 会话/存档（W3）、真实事件与战斗 UI（W4 起）**均未实施**；其余"未来时态"描述仍是计划而非成果。
- 估算为设计假设（剩余约 19–30 人日，见 implement.md），不是日期承诺。
