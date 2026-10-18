# 迁移清单与版本切换

## 1. 三份工程的职责

| 工程 | 现在 | 迁移期间 | Godot 试玩通过后 |
| --- | --- | --- | --- |
| React 正式旧版 | 实际可玩、浏览器 v2 档 | 保持入口、规则与旧档，不接入新规则 | 保留为旧版；是否下线另行评审 |
| TS prototype V1 | 已验证规则和参考轨迹 | 冻结的移植 oracle；只修已证实缺陷并显式重冻结 | 保留夹具、测试和复现工具；停止新增玩法 |
| Godot | 尚不存在 | 先 V1 等价移植，再 V2 玩法实验 | 新试玩唯一产品运行实现 |

“冻结 TS”不等于删除旧版；“Godot 通过”不等于允许旧档被覆盖。也不把 TS UI 打包进 Godot 充当迁移。

## 2. 源文件迁移矩阵

| 当前文件/组 | 处理 | 目标/理由 |
| --- | --- | --- |
| `src/game/prototype/types.ts` | 逐字段移植 | domain model + codecs；V1 保持字段/枚举/空值语义 |
| `src/game/prototype/engine.ts` | 移植并按职责拆分 | Rules、Requirements、Effects、DayCycle、Combat、Queries；拆文件不改结算顺序 |
| `src/game/prototype/random.ts` | 精确移植 | Rng32，黄金向量与 draw count；不能换引擎 RNG |
| `src/game/prototype/content.ts` | V1 保留权威；V2 后停止扩展 | V1 生成 JSON；V2 使用新唯一 JSON 源，见下文 |
| `src/game/prototype/validation.ts` | 复用合同/用例，重写运行实现 | Godot ContentLoader/StateCodec；Node 构建校验保留 |
| `src/game/prototype/simulation.ts` | V1 保留；移植公开政策和报告结构 | Godot tests/simulation，政策只读公开状态，不读未来/RNG |
| `src/game/prototype/prototype.test.ts` | 按风险迁移用例 | Godot runner；不按行复制所有断言、不将 UI 文案当规则 |
| `shared/prototype/*`、`shared/fixtures/prototype/*` | 原样保留 | Godot 测试资源同步副本，完整状态对照；不手改基准 |
| `scripts/prototype-*.mjs` | 保留原功能 | V1 冻结/回放/审计；新增独立同步和跨引擎比较入口 |
| `src/game/engine.ts`、`types.ts`、`fang-content.ts` | 保留旧版，不整文件复制 | 提取审计/原著语境作需求证据；不能把旧评分缺陷带进新情境 |
| `campaign.ts`、`world-clock.ts` | 作为后续扩展参考 | 新首版 DayCycle 以 V1 十四日为准；165 日/季节不顺带搬迁 |
| `storage.ts` 与旧档测试 | 旧版保留；新实现重写 | SaveService + 平台适配；不同格式、路径和命名空间 |
| `guidance.ts`、`JourneyGuide.tsx` | 复用提示意图，重做规则投影 | PreparationView/机会清单，不复用旧推荐打分逻辑 |
| `App.tsx`、`main.tsx` | 旧版保留；Godot 重写组合根 | Main、ScreenRouter、GameSession，React 生命周期不迁移 |
| `WorldMap.tsx` | 复用地点结构与语义，重做场景 | 地点入口 + Node2D/Area2D 交互 |
| `GamePanels.tsx`、`FangChapter.tsx`、`ChapterEnding.tsx` | 视觉/文案参考 | Control 面板、事件与结局；原长篇因果不自动变十四日 |
| `CombatPanel.tsx` | 参考可见意图/成本，重做 UI | CombatView + Control；不移植旧篇不同敌人规则 |
| `GameActionButton.tsx`、`ActionFeedback.tsx`、`ui.tsx` | 重写 | 可聚焦按钮、预览/拒绝原因、结果队列；不可附带资源结算 |
| `GuArtwork.tsx`、CSS、SVG 素材 | 挑选、导出/转换、校验授权 | 不能直接导入 JSX/CSS；检验 SVG 特性，必要时静态图片 |
| `chapter*.ts/tsx`、旧原创内容与其测试 | 保留旧工程、首版不迁移 | 非默认方源首版目标，避免混入另一套规则 |
| Vitest/Playwright 现有测试 | 旧版回归保留 | 不假定浏览器 E2E 能验证原生 Godot；新场景用实际窗口验收 |
| Vite/offline `play.html` | 旧版构建继续 | Godot 桌面/Web 为独立导出，不保证单文件 HTML |

## 3. 内容权威切换的两个门槛

### 阶段 A：V1 等价移植

唯一编辑源仍为 `src/game/prototype/content.ts`。现有 freeze 生成 `shared/prototype/content.json` 和 manifest；新 sync 脚本只把已校验的生成物复制到 `godot/content/generated/` 及测试资源目录，并记录来源哈希。

编辑器不反写 shared，Godot 不读 `res://../shared`。构建/检查遇到手改副本、版本不匹配或 manifest 漂移必须失败。公开包不得带测试夹具/调试入口。

### 阶段 B：V1 逐步对照和基本恢复通过后

先登记“V1 移植完成”的引擎、源码版本、内容/夹具摘要及逐步比较报告，再为 V2 建立 `shared/scenarios/qingmao14-v2/content.json` 作为该版本的**唯一手工编辑源**。Node/Godot 分别校验同一份协议，sync 生成运行副本。版本和场景身份在切换记录中固定，不能复用 V1 标识却更改含义。

V1 `prototype-content-1`、`prototype-rules-1` 与 scenario `qingmao-fourteen-day-prototype` 保持历史基准。V2 采用独立运行标识（建议 `qingmao-fourteen-day-demo`）与明确 rules/content 版本，新局重新开始；首版不自动转换原型存档。

V2 规则仅在 GDScript 中演进，TS reducer 不跟随新增效果。若保留 V1 回放导致明显维护成本，可把 V1 测试工具固定在已验证快照，V2 不再承担永久多版本运行兼容；任何支持范围调整须记录，不让旧夹具悄悄变成 V2 预期。

只有内容源可以手改；神似的两个 JSON 并非两个源。格式规范、生成标记、摘要与检查脚本须在切换前存在，不能靠开发者记忆维持。

## 4. 新旧存档与发布切换

- 旧浏览器 v2 不迁移，旧 URL/工程仍可继续原档。
- Godot 新 envelope 独立目录/槽。继续游戏只展示当前支持版本；不兼容候选显示原因，不删除、不自动覆盖。
- 正式试玩只绑定 V2 Catalog；V1 调试回放资源由测试命令显式载入，玩家不能在标题用调试加资源。
- macOS 先用本地 debug/试玩导出实际启动；无签名、公证、Windows 实机或商店测试，不宣称已发布到那些平台。
- Web 是单独可行性产物，记录浏览器、URL/站点存储、加载、输入和导入导出。换 origin 后不承诺旧站点存储仍可读。

## 5. 回退与完成定义

| 失败发生处 | 回退点 | 必须保留 |
| --- | --- | --- |
| 引擎/导入/导出 | W0 最小工程或旧 Web | 版本/日志、可复现环境步骤 |
| RNG/规则差异 | V1 冻结基准，停止玩法扩张 | 首差轨迹和失败种子，不能重写 expected 来迎合移植 |
| 存档不可靠 | 当前内存 + 导出备份，修复存储层 | 原 current/backup，坏档样本与故障步骤 |
| 玩法实验不改善决策 | 前一版 V2 内容/规则快照或 V1 | 前后报告；不将实验失败归咎于引擎 |
| 表现超预算 | 占位场景和简化表现 | 完整规则、真实输入路径、保存与失败行为 |

迁移完成需同时满足：新窗口真实输入到结局、规则对照、恢复、玩法实验报告、本机导出和 Web 结果。仅有编译、headless、截图或旧浏览器可访问均不足。
