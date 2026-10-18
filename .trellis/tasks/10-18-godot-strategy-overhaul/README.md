# Godot 4 改造路线入口

2026-10-18 · **W0 已交付（Godot 4.7.2-stable 壳层与最小双导出）；实现方案重设计已评审通过，用户要求先提交再实施。** 此前 P1 的实施授权与证据保留；P2–P4 依据最新方案与阶段门槛推进。

首版方向仍是桌面优先、保留 Web 可行性；2D 小场景探索、事件和回合战斗；独立 14 日情境、三地点、四蛊和两类准备路线。正式 165 日内容后续另行规划，新旧存档隔离。

## 最新详细计划

**从 [架构重构计划入口](../10-18-godot-architecture-plan/README.md) 阅读。** 其中包括：

- [架构与状态所有权](../10-18-godot-architecture-plan/design.md)
- [动作、内容、RNG 与存档合同](../10-18-godot-architecture-plan/contracts.md)
- [玩法重构与节奏实验](../10-18-godot-architecture-plan/gameplay.md)
- [源码迁移矩阵与内容权威切换](../10-18-godot-architecture-plan/migration.md)
- [W0–W8 工作包、可见交付和估算](../10-18-godot-architecture-plan/implement.md)
- [验证与证据矩阵](../10-18-godot-architecture-plan/validation.md)

父 [PRD](prd.md) 保留原 R1–R6/AC1–AC10；父 [设计](design.md) 保留此前产品方向。新计划细化迁移合同和阶段顺序，发生冲突时以最新架构计划为准，不能用此前批准状态跳过本版评审。

**最新（已批准）：[实现方案重设计与玩法 v2 入口](../10-18-godot-impl-redesign/README.md)。** 该方案在 W1 起的实现细节与玩法层面细化/修订架构计划：W1–W8 全程覆盖、玩法三幕重设计（9 个新事件 + 规则增量 D1–D5）、跨引擎对照改"黄金轨迹 + 600 局哈希链"、W1 增设序列化字节等价硬门槛；冲突处以该方案为准。

## 子任务与门槛

| 子任务 | 当前状态/交付 | 下一门槛 |
| --- | --- | --- |
| [P1 策略原型](../10-18-godot-strategy-prototype/prd.md) | 规则与验证已提交；in_progress 尚未归档 | 保留冻结夹具及历史证据 |
| [架构计划](../10-18-godot-architecture-plan/prd.md) | planning，详细方案待评审 | 本版方案评审 |
| [实现方案重设计](../10-18-godot-impl-redesign/README.md) | planning 记录，方案已批准 | 按 W1–W8 承接三个子任务 |
| [P2 Godot 基础](../10-18-godot-domain-foundation/prd.md) | in_progress；W0/W1/W2 已交付，W2 证据在子任务内（实现尚未提交） | W3 会话/存档 |
| [P3 三地点试玩](../10-18-godot-playable-slice/prd.md) | planning；W4–W7 | 可玩第1日→完整V1→有限V2实验→体验收敛 |
| [P4 集成验收](../10-18-godot-validation-release/prd.md) | planning；W8 | 桌面包、V2独立评估、Web结果 |

P1 之后剩余粗估 **18–29 开发人日**（重设计方案调整为 **19–30**：P2 7–11、P3 9–14、P4 3–5，见 [新方案 implement.md](../10-18-godot-impl-redesign/implement.md)）；不含已做 P1，不承诺日期。第一个可见 Godot 窗口已在 W0 交付，不等于完整试玩。

## 证据和当前可运行内容

P1：295 项测试、600 局逐步重放；开发集和首次保留集战备/庇护均100%生还、劳作0%。完整证据见 [P1 验证](../10-18-godot-strategy-prototype/verification.md) 和 [规则冻结](../10-18-godot-strategy-prototype/rules-freeze.md)。这不能证明中后段有趣或真人可理解；后期重复劳作已在重设计方案中处理（三幕节奏，见 [新方案 gameplay](../10-18-godot-impl-redesign/gameplay.md)）。

浏览器 `127.0.0.1:5173` 仍是旧 React 游戏；TS 原型只有规则/CLI。Godot 侧 W0 已执行：引擎 4.7.2-stable 锁定、原生壳与最小 macOS/Web 导出（证据见 [W0 证据](../10-18-godot-domain-foundation/w0-toolchain-evidence.md)）；规则、会话、存档尚未实施。早期静态证据见 [当前策略审计](research/current-strategy-audit.md) 与 [Godot 研究](research/godot-migration-evidence.md)。

本次先提交规划与关联元数据，再进入 P2 W1；不发布、不推送远端。
