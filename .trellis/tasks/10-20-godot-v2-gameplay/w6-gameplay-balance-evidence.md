# W6 V2 玩法平衡与留出集证据

日期：2026-10-21（Asia/Shanghai）。本文件是 `w6-v2-content-rules-evidence.md` 的
平衡/消融/留出集部分索引，聚合摘要见 `w6-balance-summary.json`。

## 输入

| 项 | 值 |
| --- | --- |
| scenarioId | `qingmao-fourteen-day-v2` |
| rulesVersion | `qingmao-rules-2` |
| contentVersion | `qingmao-content-2` |
| contentSha256 | `70c04afba159e88ae7848ec3ca4f972ba3789ddddb176f66e75f70efbc410b0a` |
| v2_policies.gd SHA256 | `abc88a39d23bc84b613f5f28a0c63cc6fa1e646e1ca929168001fdecf1573200` |
| v2_balance.gd SHA256 | `528992ffc9752cb792baa38a60fcc7212b7db127486ced94f407efcb072b9064` |
| 留出登记 | `holdout-registration.md`（首跑前登记） |
| 引擎 | `4.7.2.stable.official.ed1daf0bf` |

## 开发集与留出集

| 集合 / 策略 | 存活 | 后段非劳作均值/最小 | 平均余石 | 结局 |
| --- | --- | --- | --- | --- |
| dev war-ready | 100/100 | 10/10 | 2.0 | held-the-line 100 |
| dev network | 100/100 | 13/13 | 14.0 | shelter-secured 100 |
| dev labor | 0/100 | 0/0 | 70.0 | overrun 100 |
| holdout war-ready | 100/100 | 10/10 | 2.0 | held-the-line 100 |
| holdout network | 100/100 | 13/13 | 14.0 | shelter-secured 100 |
| holdout labor | 0/100 | 0/0 | 70.0 | overrun 100 |

开发集种子 1–100；留出集 20001–20100，登记后只跑一次，结果未用于调参。
静态窗口：第 5–13 日每天至少 1 个事件；第 7–13 日每天至少 1 个 V2 新事件。

## 消融（开发集）

| 移除项 | war-ready | network | 结论 |
| --- | --- | --- | --- |
| 无 | 100%，后段 10 | 100%，后段 13 | 基线 |
| `drilled` | 100%，后段 7 | 100%，后段 13 | war-ready 后段 10→7；network 不受影响 |
| `safe-route` | 100%，后段 10 | **0%**，后段 10 | 借势路线依赖复核退路 |
| 玉皮 + 地听草 | 100%，后段 2 | **0%**，后段 4 | 有效蛊是关键因果 |

## 口径与限制

- 后段非劳作只统计第 8–14 日真正消耗日行动的动作；WORK/END_DAY 排除，
  CHOOSE 按事件 actionCost，其他按 `state.actions` 是否减少。
- 策略是固定测量工具，不是最优 AI；100% 存活不等于真人理解/趣味通过。
- W5 真人键鼠三局、W7 实机失焦/长文、W8 桌面包/Web 实测仍未完成。
- 原始报告在 `artifacts/godot/w6/`（被忽略）；`w6-balance-summary.json` 是入库的
  可复跑聚合摘要。
