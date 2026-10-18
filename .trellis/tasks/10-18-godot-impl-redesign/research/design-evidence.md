# 证据索引（设计输入）

本文件列出本方案依赖的证据与读取位置，供实施/检查代理派发时按需装载。**姿态**：本文档与方案文档都是设计输入；数值与语义的最终权威是代码与既有证据文件本身，不是本目录的转述（gameplay.md 顶部已声明同一原则）。

## 1. P1 冻结实现（规则权威）

- `src/game/prototype/types.ts` — 全部共享类型（行动/需求/效果/状态/视图/轨迹/报告）；contracts.md §1–§2 以它为权威。
- `src/game/prototype/engine.ts` — 规则语义与拒绝文案的唯一权威（W2 逐条对照）。本轮复核重点：SCOUT 校验不要求蛊（118–121 行），有/无蛊效果分支（406–423 行）；TRAVEL 免费（376 行）；最终日供养后直接开危机、不恢复（263–294 行）；战斗 turn 初值 0（199 行）。
- `src/game/prototype/content.ts` — 19 事件与全部参数的具体值（v2 内容编写的基线）。
- `src/game/prototype/random.ts` — Mulberry32（rng32.gd 的移植源）。
- `src/game/prototype/validation.ts` — 冻结 V1 内容校验器；参数白名单（54–59 行）、固定两敌人（76–82 行）、敌人字段白名单（103–105 行）、引擎旗标依赖例外/可达根（229/253 行）。V2 不能直接复用其完整入口，须由计划中的版本路由选独立 schema；不修改该 V1 文件。
- `src/game/prototype/simulation.ts` — 三策略脚本（v2 策略改造的基线）。
- 证据：`../10-18-godot-strategy-prototype/verification.md`（295 测试、600 局、留出集纪律）。

## 2. 跨引擎交接

- `shared/contracts/prototype-trace-v1.md` — 规范 JSON、uint32 合同、全状态比对要求、包内数据约束。
- `scripts/prototype-common.mjs` — 规范序列化与哈希实现（design.md §5 的字节等价基准）。
- `scripts/prototype-freeze.mjs` / `prototype-simulate.mjs` / `prototype-replay.mjs` — 冻结产物、留出集纪律（10001–10100 已看过，回归用）、`--verify` 阈值（war/network ≥70%、labor ≤40%）。

## 3. W0 证据（工具链）

- `../10-18-godot-domain-foundation/w0-toolchain-evidence.md` — Godot 4.7.2-stable 锁定、36/36 冒烟、真实窗口、macOS 导出 77.7MB、Web 加载；含未测项清单（继续有效）。
- `godot/README.md`、`godot/project.godot`、`godot/export_presets.cfg` — 命令与配置现状（导出命令以 W0 记录为准）。
- `godot/tests/run_all.gd`、`capture_w0.gd` — 套件 runner 与真实输入捕获的起点。

## 4. 计划与验收基线

- `../10-18-godot-architecture-plan/` — 已批骨架；其中 `validation.md` 是 AC1–AC10 原文与父矩阵 V0–V12 的出处。
- `../10-18-godot-strategy-overhaul/` — 父需求、P2–P4 子任务与规划验证。
- `../10-18-godot-playable-slice/`、`../10-18-godot-validation-release/` — W4–W8 承接任务的既有文档。
- 规范：`.trellis/spec/frontend/strategy-prototype.md` 等（清单见 implement.jsonl / check.jsonl）。

## 5. 玩法设计输入

- `docs/GAME_DESIGN_OUTLINE.md`、`docs/SANDBOX_REFORM_PLAN.md` — 沙盒愿景（时间压力、威胁升级、开放事件图）中与十四日切片相关的约束。
- `docs/FANG_SOURCE_NOTES.md` — 原作口径（称谓、经济感）用于文案写作。
- P1 轨迹分析（600 局：war 100% / network 100% / labor 0%；中后段重复劳作）来自 prototype 任务的验证/平衡报告。

## 6. 已声明的不确定性（实施时须复核）

- 方案文档中标注"假设值"的一切数值（清单见 gameplay.md §9）。
- V1 战斗与结算的精确顺序、文案（以 `engine.ts` 为准；W2 对照时逐条核）。
- Web 持久化能力（W3 实测，含受限环境的阻断路径）。
- 导出命令与产物路径（以 `godot/README.md` 的 W0 记录为准）。

## 7. 2026-10-18 评审修订边界

- 必修七项及检查结果以 `../planning-verification.md` 为记录；新合同仍是待评审设计，不是运行证据。
- 盘问未了结后果采用现有 exposure 结构，不增加 action/requirement/effect kind；具体公式与边界以 `../contracts.md` D1 为准。
- `.trellis/spec/frontend/strategy-prototype.md` 记录的是已实现 P1，不将尚未实施的 Godot 会话/存档/V2 方案写成既成规范；W1/W3/W6 通过后再按各自任务同步 code-spec。
