# Godot 4 改造路线入口

2026-10-18 · **当前先评审详细架构计划，尚未创建 Godot 工程。** 用户最新要求：“玩法可以改造，先创建详细的重构成 godot 架构计划”。此前 P1 的实施授权与证据保留，P2–P4 依据本次更新后的方案评审再开工。

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

## 子任务与门槛

| 子任务 | 当前状态/交付 | 下一门槛 |
| --- | --- | --- |
| [P1 策略原型](../10-18-godot-strategy-prototype/prd.md) | 规则与验证已提交；in_progress 尚未归档 | 保留冻结夹具及历史证据 |
| [架构计划](../10-18-godot-architecture-plan/prd.md) | planning，详细方案待评审 | 本版方案评审 |
| [P2 Godot 基础](../10-18-godot-domain-foundation/prd.md) | planning；W0–W3 | 原生可见壳→数据/规则对照→会话/存档 |
| [P3 三地点试玩](../10-18-godot-playable-slice/prd.md) | planning；W4–W7 | 可玩第1日→完整V1→有限V2实验→体验收敛 |
| [P4 集成验收](../10-18-godot-validation-release/prd.md) | planning；W8 | 桌面包、V2独立评估、Web结果 |

P1 之后剩余粗估 **18–29 开发人日**：P2 7–11、P3 8–13、P4 3–5。前提/风险见工作包文档；不含已做 P1、不承诺日期。第一个可见 Godot 窗口目标在 W0 的 1–2 人日，不等于完整试玩。

## 证据和当前可运行内容

P1：295 项测试、600 局逐步重放；开发集和首次保留集战备/庇护均100%生还、劳作0%。完整证据见 [P1 验证](../10-18-godot-strategy-prototype/verification.md) 和 [规则冻结](../10-18-godot-strategy-prototype/rules-freeze.md)。这不能证明中后段有趣或真人可理解，后期重复劳作已纳入新计划。

浏览器 `127.0.0.1:5173` 仍是旧 React 游戏；TS 原型只有规则/CLI，Godot 引擎、窗口、GDScript、存档和导出未执行。早期静态证据见 [当前策略审计](research/current-strategy-audit.md) 与 [Godot 研究](research/godot-migration-evidence.md)。精确稳定引擎版本须 W0 实测锁定，不把研究候选视作安装证据。

本轮只改规划文档与任务元数据，不提交、不发布；用户已暂存资料保持原状。
