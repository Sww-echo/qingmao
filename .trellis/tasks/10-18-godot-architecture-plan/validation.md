# 验证计划与证据定义

## 1. 已有证据与未完成边界

截至本计划，P1 的构建和 295 项测试、600 局 V1 逐步回放、内容/夹具检查和边界审计已有记录，来源见 [P1 verification](../10-18-godot-strategy-prototype/verification.md)。本轮不重复跑它们，也不将其转述为 Godot 通过。

旧 Playwright 首条在 P1 修改前已失败：期望“开始方源篇”，当前按钮为“开始这一世”，后四条未执行。保留此基线，后续如改相关 UI/流程再核对预期，不能简单删测试。没有 Godot、导出、存档和真人体验的执行通过记录。

## 2. 分层验证矩阵

| ID | 范围/关键用例 | 门槛与证据 | 承接 |
| --- | --- | --- | --- |
| V0 | 锁定引擎/模板、中文/输入、资源导入、桌面与最小 Web | 版本/哈希/运行命令、真实窗口、导出产物/阻断日志 | W0/W1 |
| V1 | uint32 边界/向量、抽样次序、初态和完整动作轨迹 | seed42 三轨迹后全 600 局逐步全状态差异为零 | W2 |
| V2 | 非法/过期动作、资源不足、未知字段、公开查询 | 输入/旧快照未变；RNG/日志/revision/保存请求数不变 | W1–W3 |
| V3 | 事件窗口首尾、暂缓、重复领奖、effects 次序、危机兜底 | 成本/标记/窗口与 V1 相符，无 UI 绕过 | W2/W5 |
| V4 | 装备/卸装/封存/唤醒、供养不足、最终日 | 今日义务不能逃费；第14日不再筹备；低资源恢复合法 | W2/W5 |
| V5 | 伤害/真元/防御/补给次数/撤退/结局实际原因 | 战斗保存前后继续同动作结果相同；撤退无奖励 | W2–W5 |
| V6 | 待决事件、巡逻战、危机战、日结后、结局恢复 | 完整状态 + RNG 相等；重启无重复支出/领奖 | W3/W5 |
| V7 | 坏档/旧档/错版本/磁盘满/替换失败/中断/迟到保存 | current/backup 至少最近有效档保留；内存正确、反馈准确 | W3/W7 |
| V8 | 双击/重入/过期预览/切场景/暂停/失焦/取消 | 一命令只提交一次；模态禁止世界输入；合法撤退/暂缓正确 | W4/W7 |
| V9 | V2 两政策/劳作/混合策略、消融、后段机会与重复度 | 版本化原始报告 + 因果分支 + 独立盲测；不套用 V1 数据 | W6/W8 |
| V10 | 中文长文/720p/1080p/键鼠/完整局时长与理解 | 实际窗口检查表和结构化试玩记录；未测项目显式未验证 | W7/W8 |
| V11 | 导出包资源/新局/恢复/结局与 Web 存储 | 解压后实际运行、包 hash；浏览器/URL/持久化结果或复现阻断 | W8 |
| V12 | 旧 Web 构建/规则与旧档隔离 | 原回归结果、旧 E2E 基线状态、新旧格式互拒不改档 | W8 |

负向用例要断言具体错误与副作用，不能只检查“进程报错”。不为装饰布局写镜像实现测试；原生输入/渲染交给真实窗口检验。纯规则和存档故障采用自动 runner，控制范围。

## 3. 与父任务验收的映射

| 父标准 | 需要的新证据 |
| --- | --- |
| AC1 完整真实试玩 | W4→W5→W8 原生增量演示、两路线从新局到结局 |
| AC2 两类策略 | V1 迁移对照 + V2 不同投入和危机出口的真实输入轨迹 |
| AC3 机会成本 | V2 同种子分支和收益/期限差异，含后段决策 |
| AC4 成长/有效蛊/关系 | 分别移除关键准备的因果对照与 UI 一致 |
| AC5 规则不可绕过 | V2–V5/V8，普通输入与非法导入 |
| AC6 跨引擎一致 | 同版本 V1 全量逐步对照；不要求规则已经改变的 V2 与 V1 相同 |
| AC7 保存恢复 | V6/V7，真实退出重开与故障注入 |
| AC8 旧版保留 | V12，旧格式保留且不会被新试玩自动转换 |
| AC9 多种子报告 | V9，开发和首次独立 V2 保留集分开，含失败和行动分配 |
| AC10 Web 结果 | V0 早期可行性 + V11 候选浏览器实测/阻断 |

## 4. 命令状态

**现有入口**，本轮仅核对定义，未重新运行产品测试：

```sh
npm run check
npm run test:e2e
npm run prototype:freeze -- --check
npm run content:validate
npm run prototype:replay
npm run prototype:audit-combat
npm run prototype:simulate -- --set development --verify
npm run prototype:simulate -- --set holdout --verify --out artifacts/prototype/holdout
```

**计划新增入口**，现在不可声称已经存在或通过：

```sh
npm run godot:sync-content -- --check
npm run traces:compare
godot --headless --path godot --editor --quit
godot --headless --path godot --script res://tests/run_all.gd
godot --path godot
godot --headless --path godot --export-debug 'macOS' ../artifacts/godot/qingmao-demo.zip
godot --headless --path godot --export-debug 'Web' ../artifacts/godot/web/index.html
```

二进制实际路径、preset 名称、导入和测试参数在 W0–W3 按锁定版本实测并写入运行说明。headless 成功不能替代接下来从 `.app`/包/浏览器进行真实操作。首次浏览器加载不能替代刷新、关闭重开和存储拒绝的验证。

## 5. 报告与产物规则

每次门槛报告记录：时间、源码标识/dirty 状态、引擎和模板、OS/CPU、渲染、scenario/rules/content/format 版本、内容摘要、执行命令、退出码、输入/种子集、结果与未测项。大体积轨迹/导出放被忽略的 `artifacts/godot/`；任务内保留可复现入口、精简结果和产物摘要，不只留下会过期的临时路径。

规则对照报告输出首差，不吞掉不一致。玩法报告包含各政策总局数、生还/结局、伤势、元石/成长/蛊、暴露、行动分配、失败原因和全量种子清单。保留集修改后不再称首次盲测。

首版候选冻结后运行适用完整检查；若只修文案/占位图，按影响范围检查，不无理由重跑所有种子。新规则、序列化或 RNG 变化则重冻结并运行对应回归。

## 6. 本轮文档验收

检查新任务状态 planning、父子链接、JSON/JSONL 格式与实际上下文文件、Markdown 本地链接、包与验收映射及空白错误；确认未修改产品代码/依赖/冻结夹具。具体执行结果写入 [planning-verification.md](planning-verification.md)，不把未来产品检查项标已通过。
