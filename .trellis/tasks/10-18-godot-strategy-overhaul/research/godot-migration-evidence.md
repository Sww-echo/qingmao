# Research: Godot 4 迁移约束与官方证据

- **Query**: 研究当前 React / TypeScript 单机图文策略游戏迁移 Godot 4 的语言、导出、存档、资产、测试、随机数及目录边界；仅研究，不实施。
- **Scope**: mixed（本地代码 + Godot 官方 stable 文档及官方 GitHub 发布信息）。
- **Date**: 2026-10-18（Asia/Shanghai）。
- **Active task**: `.trellis/tasks/10-18-godot-strategy-overhaul`；已通过 `task.py current --source` 确认。

## Findings

### 1. 已验证事实、版本与证据可靠性

1. 官方发布 API `https://api.github.com/repos/godotengine/godot/releases/latest` 本次返回 `4.7.2-stable`，`published_at = 2026-08-18T16:12:28Z`，`prerelease = false`。对应 [Godot 4.7.2 stable 发布](https://github.com/godotengine/godot/releases/tag/4.7.2-stable)。这是查询时的官方最新稳定发布记录，**本轮没有安装，也没有为项目锁定版本**。
2. 文档取自官方 `godotengine/godot-docs` 的 `stable` 分支，本次快照提交为 `6d86d7c7f3b8f4f56c71e113022d72fe80b2c84d`；该快照 `conf.py:72` 的默认文档版本为 `4.7`。后文引用这个稳定文档快照，不使用 master 分支推断已发布功能。
3. 默认 Python 请求访问部分 `docs.godotengine.org` 页面遇到 HTTP 403；添加常见 User-Agent 后，Web 导出 HTML 页面可读取。其余证据从**官方仓库同一 stable 快照的原始 RST 文档**读取核对。不是只凭记忆列出链接。
4. 本地 `shutil.which('godot' / 'godot4' / 'Godot')` 均返回 `None`；`/Applications` 和 `~/Applications` 未发现名称匹配 `*Godot*.app` 的应用。这个结果仅覆盖 PATH 和上述常见位置，不能证明整台机器的其他目录没有 Godot。
5. 本轮未安装软件、未创建 Godot 工程、未运行 Godot / Web 导出 / headless 测试；下述命令属于**待执行验证入口**。

### 2. Files Found

| File Path | Description / evidence |
|---|---|
| `package.json` | React 19.2.8 / TypeScript 5.9.3 / Vite 8.1.5；Vitest、Playwright；构建还执行离线 HTML 打包脚本 |
| `src/game/types.ts:178` | `GameState`，包含 `version: 2`、`seed`、`rng`、行动、蛊虫、剧情、战斗、世界事件等 |
| `src/game/types.ts:216` | `GameAction` 可辨识联合类型，可作为跨语言动作协议的参考 |
| `src/game/types.ts:249` | 存档外层 `SaveData`，含 `version: 2`、`savedAt`、`game`、`meta` |
| `src/game/engine.ts:121` | 自定义 32 位随机数算法，使用 `>>> 0` 和 `Math.imul` |
| `src/game/engine.ts:592` | `gameReducer` 先校验动作，再克隆状态并执行动作 |
| `src/game/storage.ts:11` | IndexedDB 名称、后备 localStorage key、容量和整数界限 |
| `src/game/storage.ts:158` | 严格的状态字段、ID 引用、篇章、因果与状态一致性校验 |
| `src/game/storage.ts:320` | IndexedDB 连接及事务处理 |
| `src/game/storage.ts:401` | IndexedDB 主写入 + localStorage 后备；至少一处成功才算保存成功 |
| `src/game/storage.ts:418` | 快照后串行写入队列，失败不会毒化后续队列 |
| `src/game/storage.ts:441` | 同时读取主/后备存储，按时间选择最新；损坏数据显式报错 |
| `src/App.tsx:236` | JSON 文件导出及导入；浏览器 Blob、链接下载、File API 的 UI 实现 |
| `src/WorldMap.tsx:16` | JSX 构建 SVG 山景；同文件另有地图路径 SVG |
| `src/GuArtwork.tsx:99` | JSX 蛊虫 SVG 插画 |
| `src/CombatPanel.tsx:10` | JSX 敌人肖像 SVG |
| `src/ui.tsx:39` | JSX SVG 图标，依赖 `currentColor` 等浏览器表现 |
| `src/game/*.test.ts` | 规则、章节、战斗、存档、路径可达性等现有 Vitest 用例，可作为迁移对照来源 |

### 3. 语言与规则复用约束

**官方事实**：Godot 官方支持的游戏编程语言是 GDScript、C# 及通过 GDExtension 使用的 C / C++。TypeScript 不在官方支持列表。官方也承认存在社区支持的其他语言，因此不能表述成“Godot 完全不可能使用 TypeScript”。

来源：[Scripting languages](https://docs.godotengine.org/en/stable/getting_started/step_by_step/scripting_languages.html)，[快照源文件 L26–33](https://github.com/godotengine/godot-docs/blob/6d86d7c7f3b8f4f56c71e113022d72fe80b2c84d/getting_started/step_by_step/scripting_languages.rst#L26)。

**对当前仓库的技术含义**：

- 使用标准 Godot + 类型化 GDScript 的情况下，`engine.ts`、React 组件、DOM/CSS、IndexedDB API 不能直接当作 GDScript 执行。规则和测试表达的行为能够复用，源代码需要移植或另行维护桥接运行时。
- TypeScript 接口、联合类型、`Record`、可选值和 `null` 不能机械转换成“全部 Dictionary 就同等类型安全”。需要定义明确的状态、动作与内容契约，并在 JSON 边界做运行时校验。
- 类型化 GDScript 可以在运行前发现更多类型错误，也能使用优化的指令；这不等于自动拥有 TypeScript 的类型系统。官方 stable 文档仍注明嵌套类型如 `Array[Array[Character]]` 不受支持。
- 当前 `gameReducer` 的“动作校验 → 克隆状态 → 规则结算”边界，与场景/UI 解耦后可以独立复现；迁移时不能因为改为节点脚本就让按钮、动画或场景加载自行扣资源、消耗行动或推进随机数。

来源：[Static typing in GDScript](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html)，快照源文件 L21–25、L66–68、L648–668。

### 4. 桌面与 Web 导出约束

| 项目 | 官方 stable 文档事实 | 对计划的约束 |
|---|---|---|
| Web 运行能力 | 浏览器需支持 WebAssembly 与 WebGL 2.0 | 不能把现有 DOM 网页运行环境兼容性直接当作 Godot Web 兼容性 |
| 渲染器 | Godot 4 Web 仅支持 Compatibility / WebGL 2.0；Forward+ / Mobile 不受支持 | 若同一工程需要 Web 导出，必须在该渲染路径验证资产和效果 |
| C# | Godot 4 C# 项目当前仍不能导出 Web | 若 Web 是要求，不能在未引入额外方案前承诺 C# + Web 交付 |
| 单线程 | 自 4.3 支持单线程 Web；现为默认，避免线程方案的额外隔离要求 | 图文/回合策略游戏是否需要线程应以测量决定，无须因引擎迁移默认引入线程 |
| 线程 / 扩展 | 使用线程或扩展支持会引入跨源隔离等部署约束；Web 扩展需专门编译 | 扩展/插件不能只检查桌面可用就认定 Web 可用 |
| Web 交付形态 | 导出包含 HTML、WASM、PCK 等文件并经 Web 服务提供 | 不能直接继承当前“单文件离线 HTML”的打包承诺；如保留离线能力，须单独验证 PWA / 缓存行为 |

来源：[Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)，[固定快照](https://github.com/godotengine/godot-docs/blob/6d86d7c7f3b8f4f56c71e113022d72fe80b2c84d/tutorials/export/exporting_for_web.rst)：L12–23、L36–49、L73–85，以及 Thread and extension support、PWA、Serving the files 各节。

**未决定**：首发究竟桌面优先、桌面 + Web，或继续承诺单文件离线版本，属于产品交付决定；本研究不代用户确定。

### 5. 存档：格式可以保留，存储后端必须适配

**当前事实**：当前是 IndexedDB 主存储 + localStorage 后备，不是“只有 localStorage”；并有 JSON 导入/导出、写入顺序保证、损坏档保护和字段一致性校验。

**官方事实**：

- `user://` 用于持久化用户数据；`res://` 指向工程资源，导出后通常不能用于写存档。桌面默认 `user://` 位于应用数据目录，例如 macOS 为 `~/Library/Application Support/Godot/app_userdata/[project_name]`，可通过项目设置使用自定义目录。
- Web 的 `user://` 是通过 IndexedDB 持久化的虚拟文件系统，并不等于桌面任意目录访问。官方文档指出浏览器持久化受 IndexedDB / cookie 策略、iframe 第三方存储和隐私模式影响；`OS.is_userfs_persistent()` 也可能误报。
- 官方示例使用 `FileAccess.open("user://savegame.save", ...)` 和 `JSON.stringify` / `JSON.parse`。JSON 只保存基础数据，不能直接保存 `Vector2`、`Color` 等 Godot 原生类型或任意自定义对象。
- Godot JSON 数值解析使用浮点数；JSON 也不区分 `int` 与 `float`。读取时应先验证有限数值、整数性与上下界再转换。当前 uint32 随机数状态处于 double 能精确表示的整数范围内，但不能据此删除校验。

来源：[File paths in Godot projects](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html)，[Saving games](https://docs.godotengine.org/en/stable/tutorials/io/saving_games.html)，[JSON class](https://docs.godotengine.org/en/stable/classes/class_json.html)，以及 Web 导出文档 Using cookies for data persistence 一节。

**需在设计中显式约定的技术问题**：

1. 文件格式版本、规则版本、内容版本与迁移关系；不能只把 `version: 2` 改成一个新数字就完成兼容。
2. 旧 JSON 导入是否保留所有篇章和日期，还是仅在相同规则模式恢复；新 7–14 日测试周期与旧 165 日世界时钟不能无条件互读。
3. 保留种子和随机进度、资源/引用校验、最大体积、元进度去重、主/后备选择、错误反馈的等价行为。
4. 桌面 `user://` 写入与 Web 异步落盘要分别验证；文件写成功不应被未经测试地等同于浏览器关闭后仍可恢复。
5. 浏览器数据库名称及 origin 并不自动迁移到 Godot 的虚拟文件系统。现有 JSON 导出/导入可以作为明确的迁移边界；自动读取旧站点数据库属于额外桥接工作，当前没有实现。

### 6. 32 位随机数：同种子并不自动跨语言一致

当前算法原文（`src/game/engine.ts:121`）：

```ts
state.rng = (state.rng + 0x6D2B79F5) >>> 0;
let value = state.rng;
value = Math.imul(value ^ value >>> 15, value | 1);
value ^= value + Math.imul(value ^ value >>> 7, value | 61);
return ((value ^ value >>> 14) >>> 0) / 4294967296;
```

**已验证语言差异**：GDScript `int` 是有符号 64 位整数；当前 JavaScript 算法依赖 32 位位运算、`Math.imul` 的低 32 位有符号乘积，以及 `>>>` 的逻辑右移。Godot 内置 `RandomNumberGenerator` 当前使用 PCG32，官方说明底层算法是实现细节。因此直接替换为 `RandomNumberGenerator.seed = old_seed` 不会得到现有序列，也不能用其算法名称保证后续版本的跨语言契约。

来源：[int](https://docs.godotengine.org/en/stable/classes/class_int.html)，[RandomNumberGenerator](https://docs.godotengine.org/en/stable/classes/class_randomnumbergenerator.html)。

**实现时需验证的技术合同**：

- 每步按 uint32 截断，逻辑右移前保证值位于 `0..0xffffffff`；显式实现 JavaScript `imul` 的低 32 位行为。
- 若在 64 位整数上计算乘积，不能随意将任意两个 uint32 相乘并假定其语义已与 JS 对齐。可先将乘数解释成 signed32 再乘并取低 32 位，或使用拆分乘法；最终以测试向量确认。
- 输出除数使用浮点 `4294967296.0`；保存 `rng` 的推进位置；读档、UI 查询、预览不额外抽样。
- 相同 RNG 序列还不够：动作校验、事件排序、短路条件、抽样次数和抽样先后也必须一致。
- 原规则迁移与策略规则调整应分开比较：前者可以做状态等价对照；后者的预期差异需要独立基线，不能为了“测试绿”伪装成旧规则一致。

本轮使用本地 Node 按仓库算法计算的对照向量（每格为前三次输出的 **uint32 分子**；同时可用作以后移植验证的固定样本）：

| seed | draw 1 | draw 2 | draw 3 |
|---:|---:|---:|---:|
| 0 | 1144304738 | 1416247 | 958946056 |
| 1 | 2693262067 | 11749833 | 2265367787 |
| 12185 | 2499861155 | 1810223824 | 1374101062 |
| 4294967295 | 3850105811 | 813802916 | 3073704848 |

seed 12185 对应前三次 `rng` 状态为 `1831577998`、`3663143811`、`1199742328`。这些是 **JavaScript 实测向量**；本轮没有 GDScript 实现，未声称跨语言测试已经通过。

### 7. SVG 与 React 资产的迁移范围

官方 stable 文档当前写明：SVG **默认**在导入时栅格化；可使用 `DPITexture` 在运行时按 oversampling 重新栅格化。Godot 使用 ThorVG，功能支持有限，复杂 SVG 可能与浏览器表现不同；SVG 文本需转为路径，否则不会出现在栅格化结果中。

来源：[Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)，[固定快照 L36–55](https://github.com/godotengine/godot-docs/blob/6d86d7c7f3b8f4f56c71e113022d72fe80b2c84d/tutorials/assets_pipeline/importing_images.rst#L36)，同文件 L550–554。

当前主要图形是 TSX 中的 JSX + SVG，不是独立美术文件。可复用路径、造型和配色，但需先冻结为独立资产或用 Godot 重新表达。React 条件渲染、CSS 类、`currentColor`、悬停和 SVG 节点交互不会随 SVG 导入自动变成 Godot 交互。字体和布局应独立验证，资产导入不等于原组件外观和行为已保真。

**未验证**：现有每张 SVG 经 ThorVG 渲染的具体差异、中文字体包大小与授权、最终桌面/Web 高 DPI 表现；本轮不生成或转换资产。

### 8. Headless 测试与自动化验证入口

官方 Godot 4 支持常规引擎二进制使用 `--headless`，无须 Godot 3 时代单独的 server 构建。命令行 `--script` 运行的脚本需继承 `SceneTree` 或 `MainLoop`；`--check-only` 只解析指定脚本并退出；`--import` 会等待资源导入完成后退出。`SceneTree.quit(exit_code)` 可给 CI 返回成功/失败状态。

来源：[Command line tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)，[Exporting for dedicated servers](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html)，[SceneTree.quit](https://docs.godotengine.org/en/stable/classes/class_scenetree.html#class-scenetree-method-quit)。

以后建立工程和测试脚本后，可验证以下入口（**当前路径/脚本不存在，未执行**；`godot/` 是候选项目目录）：

```sh
godot --headless --path godot --import
godot --headless --path godot --script res://tests/run_tests.gd
godot --headless --path godot --script res://tests/run_tests.gd --check-only
```

- 规则/存档/回放脚本可以无窗口运行；测试 runner 需统计失败并显式非零退出，不能只打印断言失败后仍返回成功。
- `--check-only` 不等于测试整套工程的所有场景和所有运行路径。
- headless 无法替代实际渲染验收、字体布局检查、鼠标/键盘交互及目标浏览器持久化测试。
- 桌面/Web 导出命令还需要对应版本 export templates、preset 和实际目标平台环境；本机这些条件尚未验证。
- 当前 `npm run check` 只验证既有 TS 项目；不能据此声明 Godot 项目构建通过。现有 Vitest 可输出固定动作序列/状态快照作为跨语言对照，但该工具链本轮尚未创建。

### 9. 并行迁移目录与边界的技术条件

这部分是可供主计划选用的技术边界，**不是已经批准的产品或工程目录决定**。

| 边界 | 可保持的职责 | 不应跨越的依赖 |
|---|---|---|
| 现有 `src/`、`scripts/` | 旧客户端、原规则基线、现有构建/测试 | 不因创建 Godot 工程删除或重写全部现有入口 |
| 候选 `godot/` | 独立 `project.godot`、场景、GDScript、导出配置 | Godot 运行时不依赖 React DOM / Node / TypeScript 执行环境 |
| Godot 规则层 | 状态、合法动作、结算、世界时钟、随机数 | 不直接访问 UI 节点、存储 API 或动画时间 |
| Godot 应用/适配层 | 动作派发、视图映射、SaveService、输入到动作的转换 | 场景不自行重复实现扣资源和判定规则 |
| Godot 场景/UI/资产层 | 大地图、地点、事件、战斗呈现、字体与输入 | 不把场景内自由走动自然等同于时间或行动消耗 |
| 候选中立契约/fixture 目录 | 内容 ID、JSON schema、版本、输入/输出回放样本 | 不宣称 TS 类型文件能被 Godot 直接导入运行 |

若 `project.godot` 放在仓库 `godot/`，则 `res://` 根是 `godot/`，不是仓库根。位于仓库其他目录的中立数据/fixtures 必须有明确的复制或构建同步入口，不能假设 `res://../src` 在导出后仍可用。候选目录里 `domain/`、`application/`、`persistence/`、`scenes/`、`ui/`、`data/`、`assets/`、`tests/` 可分别承载上述职责；主计划应最终只确定一套实际命名和数据来源。

## External References

所有下列引用均在 2026-10-18 查询，约束取自上文指定 Godot 4.7 stable 文档快照：

- [Godot 官方发布 API](https://api.github.com/repos/godotengine/godot/releases/latest) — 查询时最新稳定发行版信息。
- [Godot 文档 stable 快照](https://github.com/godotengine/godot-docs/tree/6d86d7c7f3b8f4f56c71e113022d72fe80b2c84d) — 可固定复查的文档证据。
- [Scripting languages](https://docs.godotengine.org/en/stable/getting_started/step_by_step/scripting_languages.html) — 语言支持和 C# 平台限制。
- [Static typing](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html) — 类型提示能力及边界。
- [Exporting for Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) — 渲染器、线程、持久化和部署限制。
- [Data paths](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html) / [Saving games](https://docs.godotengine.org/en/stable/tutorials/io/saving_games.html) / [JSON](https://docs.godotengine.org/en/stable/classes/class_json.html) — 存档适配与数字类型。
- [Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html) — SVG 导入约束。
- [CLI](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) / [Dedicated servers](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_dedicated_servers.html) / [SceneTree](https://docs.godotengine.org/en/stable/classes/class_scenetree.html) — headless、脚本运行、返回状态。
- [int](https://docs.godotengine.org/en/stable/classes/class_int.html) / [RandomNumberGenerator](https://docs.godotengine.org/en/stable/classes/class_randomnumbergenerator.html) — 整数和算法差异。

## Related Specs

- `.trellis/spec/frontend/directory-structure.md`、`state-management.md`、`quality-guidelines.md` 已读取，当前仍为 `(To be filled by the team)` 模板，不能作为已有 Godot 分层或测试规范的证据。
- `.trellis/workflow.md` 要求规划先于实现；本研究只写入当前任务的 research 文件。

## Caveats / Not Found

- 未发现现有 `project.godot`；本机常见位置未发现 Godot，不等于全盘扫描结论。
- 没有实施、安装、资产转换、Godot 测试、Web 导出或性能测量；命令和目录都是待主计划选择、以后执行的验证方案。
- 首发平台、分辨率、输入设备、旧档兼容范围与具体 Godot 小版本锁定尚属计划决策，不能由本研究擅自定案。
- stable 文档和最新发布会变化；实施时必须按实际锁定引擎/模板版本复核，本次引用快照保证研究结论可追溯。
