# 设计：时间压力与生存结局

## 边界

- **改动**：方源篇（`campaign: 'fang-yuan'`）的状态模型、引擎日结、内容门、存档校验、UI 呈现。
- **不改**：原创「石灯遗藏」支线的行为与数值；战斗、合炼、供养的既有规则。
- **不做**：经济/政治系统、战斗接入、商队内容、石林副本、狼潮逐日过程、白凝冰/血湖/再次重生。

## 数据模型

### `GameState`（`version: 2`）
- 新增 `worldEvents: string[]`：已触发的世界事件 id，由 `endDay` 按世界时钟写入。
- 季节、年份、距下一节点天数**不存储**，由 `day` 派生。
- `campaign` 语义不变（可选字段，`'fang-yuan'` 为方源篇）。
- `SaveData.version: 2`；IndexedDB 名 `qingmao-game-v2`，localStorage 键 `qingmao-game:save:v2`。

### 新模块 `src/game/world-clock.ts`（纯函数）
- 常量：`SEASON_LENGTH=30`、`YEAR_LENGTH=120`、`WOLF_TIDE_DAY=165`、`WOLF_TIDE_WARNING_DAY=125`。
- `getSeason(day)` / `getYear(day)` / `daysUntilWolfTide(day)`。
- `WORLD_EVENTS: WorldEventDef[]`（开窍大典 2–5 致命、商队 25–32、年末考核 100–110、狼潮前兆 125+）。
- `activeWorldEvents(day)` / `nextWorldEvent(day)`。
- `scoreWolfTide(standing)` / `judgeWolfTide(standing)`：分数 → 结局 id/outcome/reason。
  - 境界：未开窍 0、一转 1、二转及以上 6。
  - 蛊虫种类 0–4；元石 ≥20/60/120 → 1/2/3；疑心 ≥60 → −2；酒虫炼成 +1、见过影壁 +1。
  - ≤3 死亡、4–7 存活、≥8 立足。

## 内容模型（`fang-content.ts`）

- `FANG_STEPS` 每项新增可选 `after?: string[]`（真因果）、`opens?`、`closes?`。
- `stepEvent()` 用 `after` 生成 flag 前置（不再用上一条的 flag），并把 `opens/closes` 映射到 `dayMin/dayMax`。
- `fy-report` 去掉 `ending`，改为里程碑；文案改为「报验后狼潮仍在前面」。
- 新增 `FANG_FAILURE_ENDINGS`（死亡/错失开窍/里程碑展示用），`FANG_ENDINGS` 只保留可解锁的立足与存活。

## 引擎（`engine.ts`）

- `createGame`：`version: 2`、`worldEvents: []`、开局手记含距狼潮天数。
- `endDay`（方源篇）：
  1. 若 `day >= WOLF_TIDE_DAY` → `settleWolfTide`（按本钱判定）并返回。
  2. 否则推进日期，恢复生命/真元/行动，`closeMissedWindows` 写 `missed-*`，`fireWorldEvents` 触发到点事件。
  3. `fy-awakening-fair` 关闭后仍未开窍 → `finish('fy-missed-awakening', defeat)`。
- `checkLife` 的方源篇文案改为「倒在狼潮之前」。
- `getChoiceError`：方源篇任何带 `ending/victoryEnding` 的选项一律拒绝（终局只由世界时钟写）。
- `CHOOSE`：`fy-report` 完成时写 `milestone-first-gu`。
- 删除「未开窍禁止 ACTIVITY」的旧前置（改为开窍前禁止筹备），`BUY` 不再要求 `fy-lodged`。

## 存档校验（`storage.ts`）

- 只接受 `version: 2`。
- 校验 `worldEvents`：id 合法、按 `WORLD_EVENTS` 顺序、不早于开放日。
- 章节进度：`after` 因果前置必须满足；不能同时完成并 `missed-*`。
- 里程碑：`fy-first-gu-complete` ↔ `milestone-first-gu` 一致。
- 结局：方源篇只允许三档狼潮结局 / `fy-missed-awakening` / `departure`，且 outcome 必须匹配；`fy-first-gu` 作为结局被拒绝。
- 移除「蛊囊与炼化记录逐一对应」的线性假设，改为「未炼化前不得持有可用蛊」。

## UI

- `App.tsx`：日程条显示「第 N 日 · 季节 · 距狼潮 M 日」；结束当日对话框预告次日世界事件与临近狼潮；结算页按终局类型显示死因与本钱；首页文案改为生存框架。
- `FangChapter.tsx`：侧栏显示季节、距狼潮、下一世界事件、已错失窗口；`fangProgress` 支持跳过与错失；结局回顾列出错失与本钱。
- `guidance.ts`：优先提示窗口最近关闭的机遇；无可推进时给出 END_DAY / TRAIN。

## 权衡

- **硬截止 vs 可玩性**：165 日足够走完主线并攒本钱；错过窗口不死锁，但会削弱狼潮评分。
- **立足档暂时不可达**：本阶段境界上限一转，最高约 7 分（存活档）。立足档为后续开放二转后预留——已在交付说明中标注。
- **不兼容 v1**：按用户明确要求，直接切换，不做迁移。
