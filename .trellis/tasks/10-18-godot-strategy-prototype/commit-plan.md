# 本次提交与推送清单

2026-10-18。用户明确要求“先提交并推送远程”，并补充“txt也一并提交”；这两条授权适用于下列全部文件。此前待确认清单被本清单取代，无需重复询问。

目标：当前分支 `codex/initial-import` → `origin/codex/initial-import`（https://github.com/Sww-echo/qingmao）。采用普通推送，不amend、不force push、不合并其他分支。

## 提交分组（顺序执行）

### 1. `fix(build): restore missing optional dependency lock entries`

- `package-lock.json`

### 2. `feat(prototype): add deterministic fourteen-day strategy rules`

- `.gitignore`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/strategy-prototype.md`
- `package.json`
- `scripts/prototype-combat-audit.mjs`
- `scripts/prototype-common.mjs`
- `scripts/prototype-freeze.mjs`
- `scripts/prototype-replay.mjs`
- `scripts/prototype-simulate.mjs`
- `scripts/validate-prototype-content.mjs`
- `shared/contracts/prototype-trace-v1.md`
- `shared/fixtures/prototype/labor-42.json`
- `shared/fixtures/prototype/network-42.json`
- `shared/fixtures/prototype/war-ready-42.json`
- `shared/prototype/content.json`
- `shared/prototype/manifest.json`
- `src/game/prototype/content.ts`
- `src/game/prototype/engine.ts`
- `src/game/prototype/index.ts`
- `src/game/prototype/prototype.test.ts`
- `src/game/prototype/random.ts`
- `src/game/prototype/simulation.ts`
- `src/game/prototype/types.ts`
- `src/game/prototype/validation.ts`

### 3. `docs(godot): record architecture plan and prototype evidence`

- `.trellis/tasks/10-18-godot-architecture-plan/README.md`
- `.trellis/tasks/10-18-godot-architecture-plan/check.jsonl`
- `.trellis/tasks/10-18-godot-architecture-plan/contracts.md`
- `.trellis/tasks/10-18-godot-architecture-plan/design.md`
- `.trellis/tasks/10-18-godot-architecture-plan/gameplay.md`
- `.trellis/tasks/10-18-godot-architecture-plan/implement.jsonl`
- `.trellis/tasks/10-18-godot-architecture-plan/implement.md`
- `.trellis/tasks/10-18-godot-architecture-plan/migration.md`
- `.trellis/tasks/10-18-godot-architecture-plan/planning-verification.md`
- `.trellis/tasks/10-18-godot-architecture-plan/prd.md`
- `.trellis/tasks/10-18-godot-architecture-plan/research/architecture-evidence.md`
- `.trellis/tasks/10-18-godot-architecture-plan/task.json`
- `.trellis/tasks/10-18-godot-architecture-plan/validation.md`
- `.trellis/tasks/10-18-godot-domain-foundation/check.jsonl`
- `.trellis/tasks/10-18-godot-domain-foundation/design.md`
- `.trellis/tasks/10-18-godot-domain-foundation/implement.jsonl`
- `.trellis/tasks/10-18-godot-domain-foundation/implement.md`
- `.trellis/tasks/10-18-godot-domain-foundation/prd.md`
- `.trellis/tasks/10-18-godot-domain-foundation/task.json`
- `.trellis/tasks/10-18-godot-playable-slice/check.jsonl`
- `.trellis/tasks/10-18-godot-playable-slice/design.md`
- `.trellis/tasks/10-18-godot-playable-slice/implement.jsonl`
- `.trellis/tasks/10-18-godot-playable-slice/implement.md`
- `.trellis/tasks/10-18-godot-playable-slice/prd.md`
- `.trellis/tasks/10-18-godot-playable-slice/task.json`
- `.trellis/tasks/10-18-godot-strategy-overhaul/README.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/check.jsonl`
- `.trellis/tasks/10-18-godot-strategy-overhaul/design.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/implement.jsonl`
- `.trellis/tasks/10-18-godot-strategy-overhaul/implement.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/planning-verification.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/prd.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/research/current-strategy-audit.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/research/godot-migration-evidence.md`
- `.trellis/tasks/10-18-godot-strategy-overhaul/task.json`
- `.trellis/tasks/10-18-godot-strategy-prototype/balance-summary.json`
- `.trellis/tasks/10-18-godot-strategy-prototype/baseline.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/check.jsonl`
- `.trellis/tasks/10-18-godot-strategy-prototype/commit-plan.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/design.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/implement.jsonl`
- `.trellis/tasks/10-18-godot-strategy-prototype/implement.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/prd.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/rules-freeze.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/task.json`
- `.trellis/tasks/10-18-godot-strategy-prototype/trace-review.md`
- `.trellis/tasks/10-18-godot-strategy-prototype/verification.md`
- `.trellis/tasks/10-18-godot-validation-release/check.jsonl`
- `.trellis/tasks/10-18-godot-validation-release/design.md`
- `.trellis/tasks/10-18-godot-validation-release/implement.jsonl`
- `.trellis/tasks/10-18-godot-validation-release/implement.md`
- `.trellis/tasks/10-18-godot-validation-release/prd.md`
- `.trellis/tasks/10-18-godot-validation-release/task.json`

### 4. `docs: add Gu Zhen Ren reference text`

- `蛊真人.txt`

## 验证与状态

- 既有完整检查：构建、295项测试、开发/首次保留集共600局逐步回放，见verification.md。
- 本次提交前复核：freeze --check、content:validate、三条seed42逐步replay全部通过；文档/任务链接和JSONL检查已通过，git diff --check通过。
- 已实现的P1合同已写入frontend strategy-prototype spec；本轮Godot方案仍是计划，未将未实现设计标成已验证spec。
- `蛊真人.txt` 原本已暂存；按用户最新明确要求单独提交，文件内容不修改。
- 无未识别且未授权的脏文件。临时artifacts、node_modules、dist等保持忽略。
- 本次只提交/推送现有成果，不启动Godot实现，不自动归档仍待评审的计划任务。

## 执行引用

- 构建锁文件提交：`9c35a132e7b30ad6a19a025deab826843427eedd`
- P1规则与合同提交：`1719784015e0801c2334ebc6a7e8687df64a06fe`
- 随后提交规划/证据和txt，再普通推送当前跟踪分支；不归档、不启动P2。
