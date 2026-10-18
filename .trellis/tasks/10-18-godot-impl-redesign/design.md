# 技术设计 · 分层、接口与实现骨架（W1–W8）

> 2026-10-18 · 供评审。约束关系：用户已确认框架（U1–U4）> 父任务已批基线 > 本文件。与 `../10-18-godot-architecture-plan/design.md` 的差异见 §11，评审通过后冲突处以本文件为准。

## 0. 设计目标与硬约束

- 纯规则与引擎解耦：`domain/` 不依赖任何引擎类型（可在 `--headless` 下运行、可被测试直接调用）。
- 状态唯一所有者：只有 `GameSession` 持有 `GameState`；UI 永不直接改状态。
- 跨引擎可对照：规范化 JSON 的**字节级等价**是 W1 硬门槛（§5），它是哈希对照方案（§9）的前提。
- 规则增量最小化：V2 只改 5 条规则语义（D1–D5，见 contracts.md），不新增 requirement/effect 种类；内容保持纯数据。
- 工具链锁定：Godot 4.7.2-stable（W0 已锁定）、GDScript、Compatibility 渲染器、1280×720 基准、Noto Sans SC。
- 测试可全链路无头运行；`tests/` 沿用 W0 的 `exclude_filter` 不进导出包，内容 JSON **必须进包**。

## 1. 架构总览

四层，依赖方向单向向下；`presentation` 只读 `application` 的视图模型，`application` 只调 `domain` 的纯函数，`infrastructure` 被 `application`/`bootstrap` 持有：

```
presentation  ──读视图模型 / 提交命令──▶  application (GameSession)
                                            │
                                            ├─▶ domain   (Rules/Queries：纯函数，无引擎状态)
                                            └─▶ infrastructure (Codec/Stores/Loader —— 仅 I/O)
bootstrap/main.gd = 组合根：装配以上全部，解析启动参数（含 --verify-content）
```

- 一次动作 = `validate`（纯）→ `apply`（纯，返回新状态）→ `commit`（会话层）→ `project`（视图）→ `emit`（信号）→ `save enqueue`（见 §4）。
- 跨层数据只走两种形状：命令 `Dictionary` 与视图模型 `Dictionary`（schema 常量集中在 `session_contracts.gd`，见 contracts.md §4）。

## 2. 目录与文件清单

```
godot/
  bootstrap/
    main.gd                    # 组合根（W0 已有；W1 起改为装配 Loader/Session/Save/Router；保留 --verify-content 分支）
    screen_router.gd           # 屏幕栈（由 W0 main.gd 的换屏逻辑抽出）——W4
  domain/                      # 纯 GDScript，无场景/节点依赖
    rng32.gd                   # Mulberry32 精确移植：uint32 语义、16 位拆分乘法防 int64 溢出
    content_catalog.gd         # 由已校验 Dictionary 构建的查询表（事件/敌人/地点/蛊/常量）
    content_validation.gd      # 按三元版本选严格 schema：W1 V1；W6 扩参数/敌人/引擎来源/next
    model/game_state.gd        # 类型化状态（字段与命名以 types.ts 逐项核对为准；JSON 侧 camelCase 由 codec 映射）
    model/game_action.gd       # 行动/命令数据形状与解码入口
    rules.gd                   # validate / apply 入口（拒绝无副作用、拒绝不消耗 RNG）
    rules/requirements.gd      # requirement 求值（顺序与 V1 一致）
    rules/effects.gd           # effect 应用（顺序、账本、日志、战斗/Crisis 入口）
    rules/day_cycle.gd         # END_DAY 结算顺序（含 D1 疑心步骤）
    rules/combat.gd            # 战斗回合推进（含 D3 阶段链、D4 先手、D5 减伤）
    queries.gd                 # public view / 合法行动 / 行动预览（拒绝文案沿用 V1，逐条对照）
  application/
    game_session.gd            # 唯一状态所有者：runId、revision、命令去重缓存（64 条）、提交与信号
    session_contracts.gd       # DispatchResult / 视图模型 schema 常量与构造器
    view_projector.gd          # GameState → 视图模型（HUD/地点/事件/战斗/日结/结局）
    save_service.gd            # 存档队列：latest-wins、同槽位串行、切局代际检查、失败上报
  infrastructure/
    content_loader.gd          # 读 res://content/generated/<pack>/content.json → 校验 → 构建 catalog；失败即 loudly fail
    state_codec.gd             # GameState ⇄ Dictionary；数值整数性/范围/未知字段/版本目录引用校验
    canonical_json.gd          # 规范序列化（§5）+ sha256（HashingContext）
    desktop_save_store.gd      # FileAccess/DirAccess 实现
    web_save_store.gd          # user://（IndexedDB 后备）实现 + 能力探测
  presentation/
    interaction_controller.gd  # W0 既有：焦点/锁定/再聚焦
    player.gd / interactable.gd# W0 既有：target_id 合同
    modal_controller.gd        # 模态栈（W4 由 play.gd 抽出：打开顺序、锁输入、关闭后焦点恢复）
    presenters/hud.gd, location_view.gd, event_modal.gd, combat_modal.gd,
      gu_modal.gd, day_review_modal.gd, pause_modal.gd, ending_view.gd
  scenes/                      # title / play / ending + 各 modal .tscn（地点视图一份场景三地共用）
  content/generated/prototype/{content.json, manifest.json}        # W1 起同步产物（进导出包）
  content/generated/qingmao14-v2/{content.json, manifest.json}     # W6 起
  tests/
    run_all.gd                 # 套件 runner（W1 升级）：-- --suite=<name> 过滤；退出码 0/1/2
    suites/*.gd                # 见 §9
    policies/war_ready.gd, network.gd, labor.gd   # simulation.ts 三策略移植（仅测试）
    fixtures/prototype/*.json  # 3 条黄金轨迹（同步产物）
scripts/                       # 仓库根
  godot-sync-content.mjs       # 内容/夹具同步 + --check（漂移即失败）
  godot-content-validation.mjs # W1 委托冻结 V1 校验器；W6 增加独立 V2 schema 分支
  godot-v1-compare.mjs         # 产出期望哈希链 → 驱动 Godot 比对 → 汇总报告
```

规则：新文件一律 `class_name` + 静态类型；`domain/` 禁止 `@tool`、禁止访问 `res://`（内容以 Dictionary 注入）；`tests/`、`fixtures/` 不进导出包。

## 3. 关键接口（设计签名，最终以实现为准）

```gdscript
# domain/rng32.gd —— uint32 语义，全部运算落 0xFFFFFFFF
class_name Rng32
var state: int                       # 0..2^32-1
static func from_seed(seed: int) -> Rng32
func next_state() -> int             # step：先推进后取值（与 random.ts 逐位一致）
func state_after(steps: int) -> int  # 批量推进（测试用）
static func is_valid_state(v: int) -> bool

# domain/rules.gd —— 纯函数；入参 state 不被修改（内部在克隆上 apply）
class_name Rules
static func create(seed: int, catalog: ContentCatalog) -> Dictionary     # 初始 state
static func validate(state: Dictionary, action: Dictionary, catalog) -> Dictionary
    # {ok: true} | {ok: false, error: {code, message, fieldPath}}（文案沿用 V1；错误分类为适配层新增）
static func apply(state: Dictionary, action: Dictionary, catalog) -> Dictionary
    # {ok: false, error} 时不消耗 RNG、无任何副作用；{ok: true, state, events: Array}
static func legal_actions(state, catalog) -> Array
static func preview(state, action, catalog) -> Dictionary                # 战斗预测 / 成本预览

# application/game_session.gd
class_name GameSession extends Node
signal state_committed(revision: int, view: Dictionary, events: Array)
signal command_rejected(command_id: String, error: Dictionary)
signal save_status_changed(status: String, saved_revision: int, error_code: String)
func new_run(seed: int) -> Dictionary           # 建局并广播
func load_run(envelope_body: Dictionary) -> Dictionary
func dispatch(command: Dictionary) -> Dictionary
    # command = {commandId, runId, baseRevision, type: "action", action: {...}}
    # 结果 {ok, revision, view, events, error?}；同 commandId 重复 → 回放上次结果（dedup: true）
func snapshot_view() -> Dictionary
```

存档：

```gdscript
# application/save_service.gd
# 队列语义：latest-wins（合并未开始的快照）；同物理存档槽写串行（含不同 runId）；
# 切局递增 generation；轮换/提升前和完成回调均核验代际；失败上报 save_status_changed。
# infrastructure/*_save_store.gd（鸭子类型接口）
func read(path: String) -> Dictionary             # {ok, bytes} | {ok:false, error_code}
func write(path: String, bytes: PackedByteArray) -> Dictionary
func rename(from: String, to: String) -> Dictionary
func remove(path: String) -> Dictionary
func probe_capability() -> Dictionary             # web：IndexedDB 可用性探测
```

## 4. 一次动作的完整数据流（顺序即合同）

1. UI 组装 `command`（`commandId` 每条唯一；`baseRevision` = 当前视图的 revision）。
2. `GameSession.dispatch`：形状校验 → `runId` 检查 → 重入/就绪检查 → 当前局去重缓存 → `baseRevision == revision` 检查。缓存同键同载荷直接回放旧结果；不同载荷返回 `id-reused`；只有未命中者才检查版本（过期或超前均 `stale-revision`）。缓存上限、拒绝结果与 UI 防倒退语义见 contracts.md §3。
3. `Rules.validate`：纯检查，不消耗 RNG、不改状态；失败 → `command_rejected`，**状态与 revision 不变**（沿用 P1 保证）。
4. `Rules.apply`：在克隆上执行；**仅在接受路径**推进 RNG（rngDraws 计数、rng 状态、日志、账本、actionCounts、missed/completed 一并更新）。
5. 提交：`revision += 1`；先缓存不可变结果，再 `state_committed(revision, view, events)`。派发锁持续至存档入队完成，信号回调重入返回 `busy`；重复命令不再发信号或保存。
6. `SaveService` 入队（快照该 revision；合并未写任务）。
7. UI 以新 view 重绘；若 `events` 含事件打开/战斗/日结/结局 → 交给模态栈。

## 5. 规范化 JSON 与哈希（W1 硬门槛）

**规格（与 Node 端 `scripts/prototype-common.mjs` 的 `json()` 字节一致）**：

- 对象键递归排序（键限定 ASCII，校验器强制，规避排序语义差异）。
- 数组保序；缩进 2 空格；`"key": value`；各项独立成行；文件末尾一个 `\n`。
- 数值：**只允许整数**（校验器 + codec 双重强制；`|n| < 2^53`）；序列化十进制无前导零、无 `+`、无 `.0`。
- 字符串：UTF-8 原样，不转义非 ASCII；**内容字符串禁止控制字符**（校验器强制），规避 JS/GDScript 转义差异。
- `canonical_json.gd` 用**手写递归写出器**（不用 `JSON.stringify`），确保 0 与空串等边界行为可控。
- `sha256(bytes)` 输出小写十六进制；大 JSON 分块 `HashingContext.update`。

**硬门槛（W1 退出条件之一）**：`sha256(canonical(parse_bytes(content.json))) == sha256(content.json 原文件字节)`，对 V1 冻结产物成立。它同时证明：解析/重序列化保真、数值与转义格式一致、哈希可跨引擎比较。任何后续对照都以它为地基。

## 6. 内容管线（两阶段）

- **V1 阶段（W1–W5）**：权威源 = `src/game/prototype/content.ts`（已冻结）→ `npm run prototype:freeze` 产物 `shared/prototype/content.json` + `shared/fixtures/prototype/*.json` → `scripts/godot-sync-content.mjs` 复制到 `godot/content/generated/prototype/` 与 `godot/tests/fixtures/prototype/`，并写 `manifest.json`（source 路径 + 每文件 sha256）。
- **V2 阶段（W6 起）**：权威源 = `shared/scenarios/qingmao14-v2/content.json`（手写）→ 同一同步脚本 → `godot/content/generated/qingmao14-v2/`；Node/Godot 按同一版本合同分别校验，不直接将 V2 喂给冻结的 V1 校验器。
- **版本路由**：`scripts/godot-content-validation.mjs::validateGodotContent(content)` 按 scenario/rules/content 三元组分派；V1 委托现有 `validatePrototypeContent`，V2 用独立 schema，完整扩展参数、敌人 ID、引擎生成旗标/暴露与 next 链（contracts.md §7）。Godot 校验器与 codec 镜像该版本边界；未知版本/字段/引用都拒绝。W1 仅落地 V1 分支，W6 才加入 V2，不改 P1 冻结实现。
- **同步选择**：计划参数 `--pack prototype|qingmao14-v2|all`，默认 `prototype`；W6 显式同步 V2，`all` 必须两包都存在且通过各自校验。未知/重复/缺值参数与缺失包均非零退出；`--check` 不写文件。
- `godot-sync-content.mjs --check`：比对 manifest 哈希，漂移即非零退出（评审可复跑）。
- **导出包含性自检**：`bootstrap/main.gd` 启动早期识别 `-- --verify-content`：加载全部内置内容、打印 pack id / contentVersion / contentSha256、`quit(0/1)`。W1 起作为导出后的真机检查（W0 已证明导出可运行）。
- Godot 端只读 `res://content/generated/...`；禁止 `res://../shared` 之类越界引用（导出必挂）。加载失败 = 大声失败：编辑器内 push_error；`--verify-content` 下退出非零。

## 7. 存档设计

**Envelope**（规范化 JSON；字段语义见 contracts.md §5）：

```json
{
  "formatVersion": 1,
  "scenarioId": "qingmao-fourteen-day-v2",
  "rulesVersion": "qingmao-rules-2",
  "contentVersion": "qingmao-content-2",
  "contentSha256": "<canonical(content) 的 sha256>",
  "body": { "runId": "…", "revision": 12, "state": { } },
  "bodySha256": "<canonical(body) 的 sha256>"
}
```

- **路径**：`user://qingmao_strategy_demo/<scenarioId>/<rulesVersion>/current.json` 与 `backup.json`（写入期另有 `current.tmp`）。与旧 Web 版、与 V1 测试槽完全隔离。
- **事务不变量**：开始替换前最近一份已确认有效档，必须一直能从 current 或 backup 恢复；不承诺 current 路径在轮换期间始终存在。`savedRevision` 只在新 current 最终校验成功后前进；失败不回滚内存游戏状态。
- **写序列**：同一物理槽位持锁 → 恢复/校验旧档 → 序列化（≤2 MiB）→ 写 `current.tmp` → flush/close → 重读校验 → 再检查任务 generation → 将已验证 current 轮换进 backup → 临时档提升为 current → 重读校验 → 确认 savedRevision。轮换已有 backup 前，必须先确认 current 有效；若只有 backup 有效，先在不修改 backup 的前提下恢复 current，恢复失败即终止本次保存，禁止用坏 current 覆盖好 backup。
- **失败与切局**：任一步失败均上报 `save_status_changed("failed", …)`，尽力从 backup 恢复 current；恢复再次失败也保留 backup 并报告恢复错误。切局取消未开始任务；进行中的事务在安全点停止，轮换已开始则先恢复或完成到有效档再放锁。新旧 runId 不能并行写同一个 tmp/current，旧代际回调不能更新新局保存状态。
- **读取**：current 缺失、损坏、不兼容或 I/O 失败 → 尝试完整校验 backup；成功后返回 `recovered-backup` 状态与原失败原因，UI 明示。版本不符包括三元版本或 contentSha256 不同。只有 current/backup/tmp 全部不存在才是“无存档”；存在文件但无有效正式档则明确报错，**绝不静默开新局**。
- **临时档**：tmp 不是已提交档，不自动提升。current 或 backup 有效时忽略残留 tmp，确认恢复完成后才能清理；仅剩 tmp 时报告“保存中断，未找到可恢复的正式存档”，保留文件供诊断。
- **Web**：Godot 4 的 `user://` 在 Web 由 IndexedDB 支持；W3 用真实浏览器做「保存 → 刷新 → 继续」实测。环境受限（隐私模式/配额）→ `probe_capability()` 报告 + 只读警告文案；该实测结果是 W3 退出条件之一（或记录可复现阻断）。
- 导入/导出：整包 envelope 经文件选择器（桌面）/ 下载与上传（Web 由平台处理）——W5 提供按钮，格式即 envelope。

W3 必测中断点（各点都模拟退出重开，不仅测试函数返回错误）：

| 中断/故障点 | 重启后的必需结果 |
| --- | --- |
| tmp 写入、flush 或重读失败 | 原 current/backup 可恢复；不提升 tmp |
| 删除旧 backup 后、轮换前 | 已验证 current 仍可读 |
| current 已移入 backup、tmp 尚未提升 | current 缺失也从 backup 恢复，不显示“无存档” |
| tmp 提升失败、current 最终校验失败 | 回退到先前有效 backup，恢复写失败也不删 backup |
| current 损坏而 backup 有效时再次保存 | 先恢复；禁止轮换坏 current 覆盖有效 backup |
| 仅 tmp 残留、或正式档全部损坏/不兼容 | 明确错误且保留诊断文件，不开新局 |
| 切局时旧任务未完成 | 同槽位串行；旧代际不得在新局提交后提升文件或回写状态 |

## 8. 场景与 UI 结构（W4–W5）

- **title**：新局（可输入种子，默认随机）/ 继续 / 导入 / 退出——W0 占位升级为真实入口。
- **play**：组合场景 = HUD（日/行动/生命/真元/元石/维持预告/存档状态）+ 地点视图（一份 `location_view.tscn` 参数化三地，点选目的地提交不耗日行动的 TRAVEL）+ 行动面板（可执行动作列表，禁用项必须显示原因，文案来自 `legal_actions`/`validate`）+ 模态栈（事件/战斗/蛊/日结/暂停）。
- **ending**：结果 + reason 清单（gameplay.md §7.4）+ 本局统计 + 重开。
- **内容驱动约束**：事件界面完全由事件定义渲染（标题/正文/选项/条件/后果预览）；V1→V2 内容切换不得改 UI 代码——W6 验收以"未新增界面代码"做检查。
- 交互沿用 W0 模式：单一焦点所有者、模态打开即锁世界输入、关闭后焦点恢复；键盘全流程可完成（W7 收敛）。
- 战斗面板：敌人名/阶段（V2 危机战显示"第 1/2 波"与喘息节点）/HP/当前意图与预计伤害/护体/可用招式（含费用与禁用原因）/药酒余量（整场共用）。

## 9. 测试架构

`godot/tests/run_all.gd` 升级为套件 runner：套件清单注册在文件顶部；`-- --suite=<name>` 过滤；输出 `[suite] ok/fail: msg`；有失败退出 1，环境错误退出 2。套件：

| 套件 | 内容 | 阶段 |
| --- | --- | --- |
| smoke | W0 的 36 项检查（拆分保留） | 已有 |
| rng_vectors | 种子 0/1/12185/4294967295 × 前三次抽取与状态黄金向量 | W1 |
| canonical_json | 规范序列化规格 + **content.json 字节等价硬门槛** | W1 |
| state_codec | 往返一致、camelCase 映射、非整数/越界/未知字段负例；W6 补按版本的敌人/暴露引用 | W1，W6 扩展 |
| content_validation | V1 接受冻结内容、拒绝负例集 ≥12；W6 补 V2 参数/敌人/引擎来源/next 与版本互拒 | W1，W6 扩展 |
| rules_unit | 逐规则正反例：无蛊/有蛊侦查、拒绝无副作用、RNG 次数、日循环与最终日无恢复；W6 补 D1/D2 | W2，W6 扩展 |
| v1_replay | 3 条黄金轨迹**逐步骤全量比对**（含 log/ledger/actionCounts/rngDraws），首差异输出 JSON 路径 | W2 |
| v1_compare | 600 局动作序列 + 每步状态哈希链比对（期望文件由 Node 产出、绝对路径经用户参数传入） | W2 |
| session_semantics | 成功后同命令旧 revision 重试、id-reused、缓存淘汰、过期/超前 revision、重入、拒绝不提交、重试不重复信号/保存 | W3 |
| save_faults | §7 逐步中断矩阵、损坏/截断/超限、仅 tmp、同槽位串行/latest-wins/旧代际迟到；真实磁盘篡改一例 | W3 |
| combat_v2 | D3 阶段切换与喘息、D4 先手、D5 turn=0/1/2 与阶段边界、预览实伤一致、药酒整场共用 | W6 |
| balance_report | 三策略 × 种子集跑批 → JSON 报告（不作断言门槛，只产出证据） | W6 |

**跨引擎对照（W2 核心机制）**：

1. `npm run godot:compare -- --set development` 首先由 `scripts/godot-v1-compare.mjs` 调用 TS 引擎（P1 冻结实现）计算每局的**动作序列** + **每步状态哈希链** + 终局摘要 → `artifacts/godot/v1-expected-<set>.json`（gitignore）。
2. 脚本再以 `GODOT_BIN`（默认 `$HOME/Applications/Godot.app/Contents/MacOS/Godot`）驱动 `godot --headless --path godot --script res://tests/v1_compare.gd -- --expected=<abs>`：Godot 用移植后的三条策略逐局重放，**先比动作序列**（验证策略移植），再比哈希链（验证引擎）。
3. 首个不匹配输出 run id、步号、动作、两端哈希；工程师用 `node scripts/prototype-replay.mjs --seed <s> --policy <p> --dump <file>` 导出该局完整轨迹（`--dump` 是 W2 新增的仅开发用开关，位于 `scripts/`，不触碰 `src/`）后做全量 diff。
4. 全量差异只对 3 条黄金轨迹做（本地夹具、逐步骤）；600 局走哈希链，保证运行时长可控（预计分钟级；`--set development` 可单独驱动）。

## 10. 工具链与命令

```bash
# 测试（W1 起为主入口）
godot --headless --path godot --script res://tests/run_all.gd
godot --headless --path godot --script res://tests/run_all.gd -- --suite=canonical_json

# 内容同步（W1 起）
npm run godot:sync-content            # 同步 + 写 manifest
npm run godot:sync-content -- --check # 漂移检查（评审/验收可复跑）
# W6 起：V2 先按独立 schema 校验再同步；W8 可用 --pack all 检查两包
npm run godot:sync-content -- --pack qingmao14-v2 --check

# 跨引擎对照（W2 起）
npm run godot:compare -- --set development
npm run godot:compare -- --set holdout
GODOT_BIN="/path/to/Godot" npm run godot:compare -- --set all

# 既有（P1 侧，保持可复跑）
npm run prototype:freeze -- --check
npm run prototype:replay
npm run content:validate

# 运行与导出（导出命令沿用 godot/README.md 的 W0 记录）
godot --path godot
# 导出的应用自检内容包（W1 起）
<导出产物>/Contents/MacOS/qingmao-demo -- --verify-content
```

## 11. 与已批方案（architecture-plan）的差异清单

| # | 旧方案 | 本方案 | 理由 |
| --- | --- | --- | --- |
| 1 | 600 局逐步骤全状态对照，调试路径未定 | 3 条黄金轨迹逐步骤全量 + 600 局动作序列与哈希链；首错定位与 `--dump` 调试路径写入文档 | 全量 600 局的产物与耗时不可控；哈希链保留同等覆盖面 |
| 2 | W1 未列序列化字节等价 | 字节等价为 W1 硬门槛（§5） | 哈希对照的地基，必须先证明 |
| 3 | V2 玩法 = 重写 3–4 个事件 | 完整玩法重设计：三幕、9 个新事件、D1–D5 规则增量（gameplay.md） | 用户授权重设计 + P1 问题的根因在节奏不在事件个数 |
| 4 | V2 内容源"建议独立" | 明确 `shared/scenarios/qingmao14-v2/content.json` 手写 + 双端校验 | 消除歧义 |
| 5 | 存档目录给到根级 | 路径细化到 `<scenarioId>/<rulesVersion>/current.json` 与 `backup.json` + 写序列 + 故障语义 | 可直接实现与测试 |
| 6 | Web 持久化"待 W3 测" | W3 退出条件之一，含受限环境的探测与文案路径 | 把未知变成有结论的检查项 |
| 7 | W6 估算 2–4 人日 | 3–5 人日（28 个事件的内容编写与校准计入） | 诚实估算 |
| 8 | UI 无内容耦合约束 | "V1→V2 不新增界面代码"列为 W6 检查项；导出加 `--verify-content` | 防内容切换引发界面返工 |
| 9 | 对照命令名 `traces:compare` | 更名为 `godot:compare -- --set development/holdout/all`，并补 `--dump` 调试开关说明 | 一次产出期望、多次比对；首错定位可复现 |
| 10 | 初稿重设计将版本检查置于去重前、假设 current 不会缺失 | 去重早于 revision；以 current/backup 至少一份可恢复为不变量，补逐步中断矩阵 | 修复正常重试和轮换中断时的合同冲突 |
| 11 | 初稿 V2 校验扩展只描述 next | 明确版本分派、参数/敌人/引擎来源/codec 扩展；保留冻结 V1 校验器 | 避免为了接纳 V2 而削弱 V1 基线 |
| 12 | 初稿 D1 只有触发、D5 使用 `turn <= 2`、要求第 5 日就有新增事件 | D1 未了结转一条暴露；D5 采用 0 基前两回合；区分第 5–13 日全事件与第 7–13 日新增事件窗口覆盖 | 补齐玩法后果、边界与可执行验收 |

## 12. 风险与对策

| # | 风险 | 对策 |
| --- | --- | --- |
| R1 | GDScript 序列化与 Node 字节不一致 | 手写规范写出器 + ASCII 键/无控制字符约束 + W1 硬门槛；不过关就停下修，不进 W2 |
| R2 | Mulberry32 的 int64 溢出语义 | 16 位拆分乘法；黄金向量套件先行（rng_vectors） |
| R3 | 策略移植漂移导致 600 局对照全红 | 比对顺序：先动作序列后哈希链；先用 `--set development` 小集合 |
| R4 | Web 存储受限 | `probe_capability()` + 只读警告；实测结论（含阻断声明格式）写入证据 |
| R5 | 28 个事件编写超时 | 未变更文本直接复用 V1 文案；新事件每条约 10–20 行 JSON；W6 预留专门工时 |
| R6 | 双阶段危机战改变难度分布 | 总血量贴合 V1 区间（60–76）；W6 用开发集校准，留出集只跑一次 |
| R7 | 导出包缺内容 JSON | `--verify-content` 真机自检（W1 起每包必跑） |
| R8 | 引擎小版本漂移 | 4.7.2-stable 钉死；版本串写入每份证据 |

## 13. 实施承接与回退

| 工作包 | 承接任务 | 主要回退点 |
| --- | --- | --- |
| W1 分层地基/数据合同/内容管线 | `10-18-godot-domain-foundation` | 删除 `domain/`+`infrastructure/` 新文件即回到 W0 壳 |
| W2 规则等价移植 | 同上 | 按规则组（requirements → day_cycle → combat/crisis → queries）逐组回退，UI 尚未依赖 |
| W3 会话/存档 | 同上 | 会话与存档可停用（内存态运行），游戏逻辑不受影响 |
| W4/W5 可玩 | `10-18-godot-playable-slice` | 按屏幕回退（play 可退回调试面板驱动） |
| W6 玩法切换与平衡 | 同上 | 内容与规则版本可切回 V1（双 pack 共存） |
| W7 体验收敛 | 同上 | 逐项回退样式/文案，不动规则 |
| W8 验收交付 | `10-18-godot-validation-release` | 候选冻结失败 → 记录并回到对应工作包 |

详细步骤、命令、退出标准与估算见 [implement.md](implement.md)；验证矩阵见 [validation.md](validation.md)。
