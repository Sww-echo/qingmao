# 青茅山 · Godot 4 工程

本目录是与现有 React 版本**并行**的 Godot 4 工程。
W1–W3 已交付 V1 数据/规则、会话存档与恢复；W4–W7 已把学堂/客栈/竹林、19 个 V1 事件、
V2 28 事件内容、蛊、战斗、日结、危机、暂停/继续与 720p/1080p 键盘焦点接到真实会话。
当前是 **W8 候选**：自动门槛（6838 checks、V1 600 局对照、V2 开发/留出集、内容自检、
PCK 包内自检）已通过；正式 macOS/Web 包、浏览器持久化和真人键鼠验收仍受当前环境阻塞。

最新批准方案见 [实现重设计](../.trellis/tasks/10-18-godot-impl-redesign/README.md)，
实施包见 [implement.md](../.trellis/tasks/10-18-godot-impl-redesign/implement.md)，
W8 证据与阻塞见 [w8-acceptance-report.md](../.trellis/tasks/10-18-godot-validation-release/w8-acceptance-report.md)。

## 1. 工具链（已锁定并实测）

| 项 | 值 |
| --- | --- |
| 引擎 | Godot **4.7.2.stable.official.ed1daf0bf** |
| 编辑器安装位置 | `~/Applications/Godot.app`（本机，337 MB） |
| 编辑器产物 | `Godot_v4.7.2-stable_macos.universal.zip`（162.7 MB） |
| 编辑器 SHA256 | `c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e` |
| 编辑器 SHA512 | `38aa16e5…bac69ca`，与官方 `SHA512-SUMS.txt` **逐字节一致** |
| 导出模板 | `Godot_v4.7.2-stable_export_templates.tpz`（1222.0 MB，35 个文件） |
| 模板 SHA256 | `f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011` |
| 模板 SHA512 | `ca4d71c4…b84079`，与官方 `SHA512-SUMS.txt` **逐字节一致** |
| 模板安装位置 | `~/Library/Application Support/Godot/export_templates/4.7.2.stable/` |
| 来源 | <https://github.com/godotengine/godot/releases/tag/4.7.2-stable>（2026-08-18 发布） |
| 主机 | Apple M4 / arm64 / macOS 27.0.1 (26A434) |
| 渲染 | Compatibility（`gl_compatibility`）→ `OpenGL API 4.1 Metal - 91.7` |

未改动任何系统默认配置来掩盖问题；引擎装在用户目录，模板装在用户 Godot 目录。

W4 期间的自动化 UI 流程与窗口截图在 Linux x86_64 上补测，使用同一
`4.7.2.stable.official.ed1daf0bf` 二进制（SHA512 与官方一致），渲染仍为 Compatibility。
Linux 下用 `GODOT_BIN` 指向解压后的可执行文件即可复用下列命令。

## 2. 运行

```sh
# 首次或改动资源后：导入（.godot/ 是缓存，不入库）
npm run godot:sync-content
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --import

# 打开真实窗口
~/Applications/Godot.app/Contents/MacOS/Godot --path godot

# 全部十套件：基础、规则回放、session_semantics / save_faults / combat_v2
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/run_all.gd

# W6：以 V2 pack 启动（默认仍是 prototype V1；无新增标题控件）
~/Applications/Godot.app/Contents/MacOS/Godot --path godot -- --pack=qingmao14-v2

# W6：V2 组合根流程（标题、开局、自动存档、继续、独立槽位）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/w6_pack_switch.gd

# W4/W5：用真实场景控件跑完一局（事件/蛊/战斗/日结/存档重载，非规则直调）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/play_flow.gd

# W5：四个恢复点（事件/战斗/日结/结局）载入新会话并渲染，含 720p 布局
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/reload_flow.gd

# W5：19 个事件逐一通过通用事件 UI 检查（无逐事件写代码）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/event_coverage.gd

# W5：双击/模态/结束此日输入韧性
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/input_robustness.gd

# W5：两进程窗口级重开（event / combat / day-end；write 保存，read 从标题继续）
for scenario in event combat day-end; do
  QINGMAO_RELOAD_MODE=write QINGMAO_RELOAD_SCENARIO=$scenario \
  QINGMAO_RELOAD_ROOT=/tmp/w5-reload-$scenario \
    ~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/w5_window_reload.gd
  QINGMAO_RELOAD_MODE=read QINGMAO_RELOAD_SCENARIO=$scenario \
  QINGMAO_RELOAD_ROOT=/tmp/w5-reload-$scenario \
    ~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/w5_window_reload.gd
done

# W5：真实窗口截图（需要可用 X11/桌面；输出被 .gitignore 忽略）
QINGMAO_CAPTURE_OUT=artifacts/godot/w5 \
  ~/Applications/Godot.app/Contents/MacOS/Godot --path godot --script res://tests/capture_w5.gd

# W5：按策略跑同一套场景控件流程（war-ready / network / labor）
QINGMAO_FLOW_STRATEGY=network \
  ~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/play_flow.gd

# W6：同一场景控件流程跑 V2 pack（V1 策略仅作接线冒烟，不是 V2 平衡结论）
QINGMAO_FLOW_PACK=qingmao14-v2 QINGMAO_FLOW_STRATEGY=war-ready \
  ~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/play_flow.gd

# W6：V2 平衡报告（开发集 1–100 或登记后的留出集 20001–20100）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot \
  --script res://tests/v2_balance.gd -- --set=development --out=artifacts/godot/w6/development.json

# W4：标题/种子/暂停返回/继续的完整组合根流程
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/title_flow.gd

# 单套件；通过退出 0，断言失败 1，参数/环境错误 2
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot \
  --script res://tests/run_all.gd -- --suite=canonical_json

# 只读漂移检查 / Node 版本路由校验 / 同步工具测试
npm run godot:sync-content -- --check
npm run godot:validate-content
npm run godot:test-tools

# W6：V2 内容包（手写权威源）与同步/校验
npm run godot:sync-content -- --pack qingmao14-v2
npm run godot:sync-content -- --pack all --check
npm run godot:validate-content -- --file shared/scenarios/qingmao14-v2/content.json

# 同时执行隔离临时工程中的 runner 退出码 / loader 坏清单进程测试
# 以及八个强制终止子进程后的存档恢复测试
GODOT_BIN="$HOME/Applications/Godot.app/Contents/MacOS/Godot" npm run godot:test-tools

# W2：三策略独立运行，逐动作、完整状态哈希与累计链对照
npm run godot:compare -- --set development
npm run godot:compare -- --set holdout
npm run godot:compare -- --set all

# 首差诊断：导出某一局的完整 TS 参考轨迹（开发专用，非玩家存档）
node scripts/prototype-replay.mjs --seed 42 --policy network --dump artifacts/godot/debug.json

# 使用真实启动入口校验所有内置包（不显示壳层）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot -- --verify-content

# 生成截图证据（真实窗口 + 引擎内捕获，不需要系统录屏权限）
QINGMAO_CAPTURE_OUT=/tmp/w0-evidence \
  ~/Applications/Godot.app/Contents/MacOS/Godot --path godot res://tests/capture_w0.tscn
```

操作：标题页可输入 0–4294967295 的种子并开始新局；`WASD` / 方向键移动，`E` 与目标交互，
`Esc` 按优先级关闭当前模态（战斗不可跳过）/ 打开暂停 / 返回标题。

## 3. 导出

```sh
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot \
  --export-debug "macOS" ../artifacts/godot/macos/qingmao-demo.zip

~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot \
  --export-debug "Web" ../artifacts/godot/web/index.html
```

`artifacts/` 已被仓库根 `.gitignore` 忽略；`tests/*` 通过 preset 的 `exclude_filter` 排除在正式导出之外。
`content/generated/*/*.json` 通过 `include_filter` 显式进包。解压 macOS zip 后检查：

```sh
"<解压目录>/<应用名>.app/Contents/MacOS/<应用名>" --headless -- --verify-content
```

实际包名以导出结果为准。成功输出 pack/contentVersion/contentSha256 并退出 0；
缺文件、内容/清单损坏、哈希/版本不符均退出 1，未知启动参数退出 2。
导出成功本身不能替代包内可执行文件的自检。W3 已在隔离 Chromium 中实测保存、刷新和继续；
不代表 Safari、隐私模式、配额耗尽或浏览器崩溃时的数据耐久性已验证。
也可用编辑器读取实际 PCK，检查内容包含与测试资源排除：

```sh
~/Applications/Godot.app/Contents/MacOS/Godot --headless --main-pack "<导出pck绝对路径>" \
  --script "$PWD/godot/tests/export_probe.gd"
```

外部 probe 路径需对应当前检出目录；该测试脚本本身不随包发布。

## 4. 目录与跟踪策略

```text
godot/
  project.godot          # Compatibility + GDScript + 1280x720 基准 + canvas_items 缩放
  export_presets.cfg     # 无凭据的 macOS / Web preset
  bootstrap/main.*       # 唯一组合根：内容加载/自检、标题 <-> 地点壳
  domain/                # 纯数据模型、RNG、V1规则/查询、内容目录及严格校验（不依赖场景）
  application/           # GameSession / ViewProjector / SaveService
  infrastructure/        # canonical JSON / codecs / 内容加载 / desktop 与 Web stores
  presentation/          # 占位角色、交互目标、交互控制器（无规则）
  scenes/                # title（种子输入）/ play（真实会话 HUD、模态与学堂场景）
  ui/app_theme.tres      # 全局主题：Noto Sans SC
  assets/fonts/          # 字体 + 授权清单（见其中 README.md）
  content/generated/     # sync 脚本生成 V1 content + manifest，禁止手改
  tests/                 # 套件 runner、夹具与证据捕获，不进正式导出
```

- **入库**：`project.godot`、`.tscn`/`.gd`/`.tres`、`export_presets.cfg`、`assets/`、`content/`、`tests/`。
- **不入库**：`.godot/`（导入缓存，见 `godot/.gitignore`）、`export/`、`../artifacts/godot/`（导出产物）。
- 新克隆必须先跑一次 `--import`，否则 `res://assets/fonts/*.ttf` 等资源无法解析。

## 5. 内容与数据合同

- 权威源仍为冻结 TS；`shared/` 与 `godot/content/generated/` 都是产物，不手改。同步只读
  `shared/prototype/manifest.json` 及其四份源文件，验证后复制原始字节并生成 Godot manifest。
- manifest 的 `files` 包含 `source`、`path`（`res://`）、`sha256`、`kind`。运行时读取并验证
  `content`；所有摘要必须为 64 位小写十六进制。`fixture` 仅供开发，导出不读测试资源。
  版本三元组按 V1/V2 表精确匹配；`prototype` 与 `qingmao14-v2` 互斥，未知组合拒绝。
- `--pack prototype` 为默认；`qingmao14-v2` 加载 W6 手写 pack，`all` 同步/校验两包。
  V1 生成物逐字节不变；未知/重复/缺值选项失败。`--check` 不创建目录、不修复漂移；
  多余生成文件也报错。
- `CanonicalJson.encode` 返回 `{ok,text,bytes}` 或 `{ok:false,error}`；数组保序、
  两空格缩进、尾随 LF、安全整数十进制和 UTF-8；SHA256 对字节计算。
- `StateCodec.decode(data,catalog)` / `encode(state,catalog)` 在转换前检查整数性与范围，
  严格检查字段、枚举和所选目录引用；显式映射完整 camelCase 状态，不裁剪日志/账本/RNG。
- `Rules.create/validate/apply` 和 `Queries.public_view` 执行完整 V1 规则；接受时在深克隆上
  结算，拒绝时状态/RNG/日志/账本均不变。公开视图剔除 seed/rng/rngDraws。
- 模态由状态派生：暂停、日结、结局期间拒绝 HUD 动作；事件模态只接受 CHOOSE/DISMISS_EVENT，
  蛊面板只接受 EQUIP/GU_MODE，战斗只接受 COMBAT。键盘焦点被限制在当前模态内。
- `rules_unit` 检查非法操作与日结/战斗边界，`v1_replay` 对三条 seed42 夹具逐步全状态比较。
  `godot:compare` 产出 `artifacts/godot/v1-expected-<set>.json` 并驱动 Godot，报告为
  `v1-compare-<set>.json`；首差保留实测快照及自动导出的 TS 参考轨迹和 JSON 路径。
  使用 `GODOT_BIN` 可指定引擎，默认沿用上述本机安装；首次需导入工程资源。
  对照驱动先校验精确版本串，并在报告中记录时间、源码提交/dirty、命令、退出码和未测范围。

## 6. 当前边界（不要误读）

**W0 已做**：真实原生窗口、中文字体渲染、键鼠焦点与移动、目标交互、面板开合、窗口缩放、
最小 macOS 与 Web 导出（历史环境记录）。W8 在当前 Linux 环境用 Xvfb 重新生成了
1280×720 与 1920×1080 窗口截图，见 `../artifacts/godot/w8/window/`。

**W1 新增**：数据模型、uint32 Mulberry32、规范 JSON/SHA256、codec、严格 V1 内容校验、
同步/漂移工具、包内内容自检。验证结果见 [W1 证据](../.trellis/tasks/10-18-godot-domain-foundation/w1-contracts-evidence.md)。

**W2 新增**：requirements/effects/day_cycle/combat 四组规则、查询、三策略移植、完整黄金回放
与批量对照工具。不能把无头验证当作真实可玩演示。

**W3 新增**：命令去重、revision、完整拒绝结果、不可变视图、初始快照与自动保存、
current/backup 恢复及 tmp 中断诊断。真实窗口经自动键鼠输入验证跨进程继续，
不冒充真人完整试玩。见 [W3 证据](../.trellis/tasks/10-18-godot-domain-foundation/w3-session-save-evidence.md)。

**W5 第一增量**：三地点世界几何与安全出生点；每地点稳定热点（学堂 3、客栈 2、竹林 3），
非当前地点热点不能聚焦/点击；HUD 只读展示巡山队长、客栈掌柜、嫌疑与暴露；同一场景流程
可按 `war-ready` / `network` / `labor` 三种策略运行。

**W4 新增**：标题种子输入；可玩的第 1 日 HUD（生命/真元/元石/行动/地点/供养）；地点移动；
事件列表与通用选项模态；蛊管理（装备/封存/唤醒）；回合战斗（意图/伤害预览与七种行动）；
日结回顾（账目、错过事件、承诺、危机）；暂停、保存状态与结局模态。所有按钮只提交动作，
拒绝原因来自投影；界面不计算规则。模态会同时锁住鼠标与键盘焦点，日结/暂停期间不能用
HUD 抢跑；离开学堂会关闭说明面板并隐藏学堂热点。自动化 UI 流程见 `tests/play_flow.gd`，
组合根流程见 `tests/title_flow.gd`，证据见
[W4 证据](../.trellis/tasks/10-18-godot-playable-slice/w4-day1-evidence.md)。

**W8 自动证据**：10 套件 6838 checks / 0 failures；Node 工具 28/28；V1 对照 600 局、
53042 动作、53642 状态全等；V2 开发集与留出集 war-ready/network 100%、labor 0%，
后段非劳作 10/13/0；`--export-pack` 的 Web/macOS PCK 可做内容自检并排除测试夹具；
Xvfb 720p/1080p 窗口几何与截图已复跑。详见
[W8 报告](../.trellis/tasks/10-18-godot-validation-release/w8-acceptance-report.md)。

**W8 阻塞**：当前环境没有 Godot 4.7.2 导出模板，不能生成可启动的 macOS/Web 正式包；
没有可用 Chromium，浏览器保存/刷新/继续未复跑；没有真人键鼠、真实失焦、高 DPI 或输入法
记录。`--export-pack` 只证明包内容，不是发行包验收。导入/导出控件仍不在当前范围。

## 7. 会话接口冻结（v1，W3）

UI 仅依赖 `GameSession.new_run(seed)`、`load_run(body)`、`dispatch(command)`、
`snapshot_view()` 及三个信号；不持有 GameState，不直接调用 Rules 或磁盘 store。
命令/结果/信号形状沿用 [contracts.md §§3–5](../.trellis/tasks/10-18-godot-impl-redesign/contracts.md)。
不兼容修改必须显式升级接口版本并同步使用方和测试。

- 新局生成独立随机 runId（不消耗游戏 RNG），立即入队 revision 0。未确认保存时
  `savedRevision = -1`，状态为 `saving`；保存失败保留内存状态，绝不重做动作。
- 同局缓存最近 64 个成功、规则拒绝及 revision 拒绝结果。去重早于 revision，
  结果保留原视图与原 revision；UI 按提交信号或新快照渲染，不能用旧重放结果回退。
  action 形状校验不依赖当前事件；当前事件合法性由规则决定。
- 提交信号到存档入队期间，dispatch/new/load 重入均拒绝。读取存档清空去重，
  从 body.revision 继续，不重放已结算的效果。视图及缓存结果均为独立副本。
- `saveStatus` 和 `dayReview` 是投影，不是 UI 自行计算的规则。日结展示刚结束的日、
  新增账本、应付/实付供养、本次错过事件、庇护承诺及危机状态。
- 存档位于 `user://qingmao_strategy_demo/<scenarioId>/<rulesVersion>/`。
  Envelope v1 严格校验版本、内容/正文 SHA256、完整 state，读取前限制 2 MiB。
  与旧 Web 格式互不转换。
- SaveService 在单一进程内按规范化物理路径共享写锁及代际；未开始快照 latest-wins。
  切局取消旧任务，轮换、提升和确认均检查代际，旧回调不改新局状态。
  不承诺多个应用进程或多个浏览器标签同时写同一槽位。
- `load(false)` 仅检查（标题使用），`load()` 尝试恢复；current 无效即尝试 backup，
  并返回来源、原失败原因及恢复写错误。tmp 从不自动提升，只有 tmp 也不会当作无档。
  无有效正式档时保留诊断文件并明确失败，不静默覆盖。
- Web 通过 `OS.is_userfs_persistent()` 与实际写读探测能力；能力不足时警告，
  写入返回失败。IndexedDB 实测结论仅适用于证据所列浏览器/环境。
