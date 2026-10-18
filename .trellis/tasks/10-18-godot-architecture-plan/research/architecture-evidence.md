# 架构规划的仓库证据与交接索引

2026-10-18 · 本轮只分析现有代码/规划，没有运行或安装 Godot。此前技术研究仍是来源证据，实际版本/模板/导出能力由 W0 核验。

## 证据与结论

| 已检查来源（仓库根相对路径） | 发现 | 对设计的约束 |
| --- | --- | --- |
| `src/game/prototype/types.ts` | 完整State、有限Action/Requirement/Effect、公开政策投影 | 逐字段迁移；不以Dictionary透传或开放脚本替代合同 |
| `src/game/prototype/engine.ts` | validate先于clone；CHOOSE顺序结算；END_DAY供养后最后日直接进危机 | 查询无副作用，日结/事件不得拆成动画回调阶段 |
| `src/game/prototype/random.ts` | uint32乘法/移位的确定性随机 | 不能替换为Godot seed RNG；需显式低32位语义 |
| `shared/contracts/prototype-trace-v1.md` | 完整轨迹/日志/账本，数组原顺序，规范JSON字节摘要 | P2采用完整State对照，解决旧高层设计缩减投影不明确的问题 |
| `shared/prototype/manifest.json` | scenario=`qingmao-fourteen-day-prototype`，rules/content均V1 | 保留V1标识，V2另立版本/内容源/存档槽 |
| `src/game/prototype/content.ts` | P1内容唯一编辑源，freeze生成shared数据 | P2不能直接宣称shared JSON已是手工权威源；切换需显式门槛 |
| P1 `rules-freeze.md` / `trace-review.md` / `verification.md` | 两准备路线可达，600局逐步回放，后期重复劳作，未做Godot/真人 | 移植一致性与玩法趣味性分别验收，有限V2实验不覆盖历史结果 |
| 父任务 `research/current-strategy-audit.md` | 旧方源篇终局/成长/关系缺口，旧文档和E2E冲突 | 不要求新短情境复现旧评分；保留旧版回归边界 |
| 父任务 `research/godot-migration-evidence.md` | 资源根、GDScript/Web/字体/SVG/存档约束，环境未验证 | JSON显式同步入res根；中文本地资产；早期桌面/Web实测 |
| `package.json` / `src/App.tsx` | 现有启动仍是Vite；无Godot运行/对照命令 | 演示必须标明旧Web/规则原型/Godot各自身份，计划入口不能当执行记录 |

## 最新交接阅读顺序

1. [PRD](../prd.md)：本轮规划需求和用户已确认边界。
2. [设计](../design.md) 与 [合同](../contracts.md)：模块、提交/保存顺序、字段、版本和故障语义。
3. [迁移](../migration.md)：当前文件去向、V1→V2权威切换。
4. [玩法](../gameplay.md)：有限节奏实验与可观察标准。
5. [工作包](../implement.md) 与 [验证](../validation.md)：W0–W8、依赖、输出和退出条件。

以上方案处于待评审，不是已验证spec。P2/P3/P4引用本证据索引后仍须读取各自PRD/design/implement及相关详细合同。新产品实现未启动，旧P1收尾未归档。
