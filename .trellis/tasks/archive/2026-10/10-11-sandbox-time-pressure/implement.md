# 执行计划：时间压力与生存结局

## 顺序

1. **types**（`src/game/types.ts`）
   - `EndingId` 拆出 `FangEndingId`（含 `fy-first-gu`、`fy-missed-awakening`、三档狼潮）。
   - `GameState.version: 2`、新增 `worldEvents: string[]`；`SaveData.version: 2`。
2. **world-clock**（新建 `src/game/world-clock.ts`）
   - 季节/年份派生、世界事件表、狼潮评分与判定。
3. **campaign**（`src/game/campaign.ts`）
   - `MAX_FANG_DAY = WOLF_TIDE_DAY`；地点门改为时间 + 真因果。
4. **content**（`src/game/fang-content.ts`）
   - `FANG_STEPS` 加 `after/opens/closes`；`stepEvent` 用 `after`；`fy-report` 改里程碑；新增失败结局。
5. **engine**（`src/game/engine.ts`）
   - `createGame` v2；`endDay` 世界事件与狼潮结算；`checkLife`/`getChoiceError`/`CHOOSE` 调整。
6. **storage**（`src/game/storage.ts`）
   - v2 校验、世界事件、里程碑、结局、因果前置。
7. **UI**（`App.tsx`、`FangChapter.tsx`、`guidance.ts`）
   - 时间压力呈现与文案。
8. **测试**（4 个测试文件）
   - 重写 `fang-engine` / `fang-storage` / `review-rules` / `fang-ui` 的线性假设；新增期限、错失、狼潮评分与结算测试。
9. **文档**（`docs/GAME_DESIGN_OUTLINE.md`、`docs/SANDBOX_REFORM_PLAN.md`）

## 验证命令

```sh
npx tsc --noEmit -p tsconfig.json
npx vitest run
npm run build
```

## 验证门槛

- tsc、build 无错。
- vitest 全绿（13 文件 / 264 测试）。
- 人工确认：新局第 1 日字段、第 5 日后错失开窍、报验后 `ending` 为空且可继续、第 165 日结算后拒绝行动。

## 回滚点

- 每步为独立文件改动；如 v2 校验出问题，可单独回退 `storage.ts` 而不影响引擎/内容。
- 若时间压力被判定过紧/过松，只需调 `world-clock.ts` 的常量与阈值，无需改动内容。

## 已知遗留

- 「立足」档在本阶段不可达（境界上限一转），留待二转开放。
- `FANG_ENEMIES` 仍为空，狼潮只有到点结算，没有逐日交战过程。
