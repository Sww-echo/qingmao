# 青茅山 · Godot 4 工程

本目录是与现有 React 版本**并行**的 Godot 4 工程。可见界面仍为 **W0 原生窗口壳**，
W1 增加纯数据、严格 V1 校验、规范 JSON 和内容管线，W2 增加可无头验证的完整 V1 规则。
**规则尚未接入可见界面，GameSession 与存档属于 W3。**

最新批准方案见 [实现重设计](../.trellis/tasks/10-18-godot-impl-redesign/README.md)，
实施包见 [implement.md](../.trellis/tasks/10-18-godot-impl-redesign/implement.md)。

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

## 2. 运行

```sh
# 首次或改动资源后：导入（.godot/ 是缓存，不入库）
npm run godot:sync-content
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --import

# 打开真实窗口
~/Applications/Godot.app/Contents/MacOS/Godot --path godot

# 全部七套件：五个基础套件 + rules_unit / v1_replay
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/run_all.gd

# 单套件；通过退出 0，断言失败 1，参数/环境错误 2
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot \
  --script res://tests/run_all.gd -- --suite=canonical_json

# 只读漂移检查 / Node 版本路由校验 / 同步工具测试
npm run godot:sync-content -- --check
npm run godot:validate-content
npm run godot:test-tools

# 同时执行隔离临时工程中的 runner 退出码 / loader 坏清单进程测试
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
~/Applications/Godot.app/Contents/MacOS/Godot --path godot res://tests/capture_w0.tscn -- --out=/tmp/w0-evidence
```

操作：`WASD` / 方向键移动，`E` 与目标交互，`Esc` 关闭面板 / 返回标题。

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
导出成功本身不能替代包内可执行文件的自检。Web 持久化与刷新恢复属于 W3，W1 不作通过声明。
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
  infrastructure/        # canonical JSON / state codec / 只读内容加载
  presentation/          # 占位角色、交互目标、交互控制器（无规则）
  scenes/                # title / play（学堂占位地点）
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
  版本三元组必须精确匹配 V1。
- `--pack prototype` 为默认；`qingmao14-v2` 和 `all` 留给 W6，当前明确失败，不静默降级。
  未知/重复/缺值选项失败。`--check` 不创建目录、不修复漂移；多余生成文件也报错。
- `CanonicalJson.encode` 返回 `{ok,text,bytes}` 或 `{ok:false,error}`；数组保序、
  两空格缩进、尾随 LF、安全整数十进制和 UTF-8；SHA256 对字节计算。
- `StateCodec.decode(data,catalog)` / `encode(state,catalog)` 在转换前检查整数性与范围，
  严格检查字段、枚举和所选目录引用；显式映射完整 camelCase 状态，不裁剪日志/账本/RNG。
- `Rules.create/validate/apply` 和 `Queries.public_view` 执行完整 V1 规则；接受时在深克隆上
  结算，拒绝时状态/RNG/日志/账本均不变。公开视图剔除 seed/rng/rngDraws。
- `rules_unit` 检查非法操作与日结/战斗边界，`v1_replay` 对三条 seed42 夹具逐步全状态比较。
  `godot:compare` 产出 `artifacts/godot/v1-expected-<set>.json` 并驱动 Godot，报告为
  `v1-compare-<set>.json`；首差保留实测快照及自动导出的 TS 参考轨迹和 JSON 路径。
  使用 `GODOT_BIN` 可指定引擎，默认沿用上述本机安装；首次需导入工程资源。
  对照驱动先校验精确版本串，并在报告中记录时间、源码提交/dirty、命令、退出码和未测范围。

## 6. 当前边界（不要误读）

**已做**：真实原生窗口、中文字体渲染、键鼠焦点与移动、目标交互、面板开合、窗口缩放、最小 macOS 与 Web 导出。

**W1 新增**：数据模型、uint32 Mulberry32、规范 JSON/SHA256、codec、严格 V1 内容校验、
同步/漂移工具、包内内容自检。验证结果见 [W1 证据](../.trellis/tasks/10-18-godot-domain-foundation/w1-contracts-evidence.md)。

**W2 新增**：requirements/effects/day_cycle/combat 四组规则、查询、三策略移植、完整黄金回放
与批量对照工具。可见窗口仍为 W0 壳，不能把无头验证当作真实可玩演示。

**未做**：GameSession/独立存档/恢复（W3）、真实事件与战斗 UI
（W4 起）、V2 schema 与玩法（W6）。`application/` 保留给 W3，不用无行为占位类冒充接口已冻结。
