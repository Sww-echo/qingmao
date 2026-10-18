# 青茅山 · Godot 4 架构演示（W0）

本目录是与现有 React 版本**并行**的 Godot 4 工程。它目前只交付 **W0：可见的原生窗口壳**，
**尚未接入任何游戏规则**。界面上所有出现的地方都会写明这一点。

改造方案见 [`.trellis/tasks/10-18-godot-architecture-plan/`](../.trellis/tasks/10-18-godot-architecture-plan/README.md)，
实施包见 [implement.md](../.trellis/tasks/10-18-godot-architecture-plan/implement.md) 的 W0。

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
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --import

# 打开真实窗口
~/Applications/Godot.app/Contents/MacOS/Godot --path godot

# 壳层冒烟检查（36 项，失败非零退出）
~/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --script res://tests/run_all.gd

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

## 4. 目录与跟踪策略

```text
godot/
  project.godot          # Compatibility + GDScript + 1280x720 基准 + canvas_items 缩放
  export_presets.cfg     # 无凭据的 macOS / Web preset
  bootstrap/main.*       # 唯一组合根：标题 <-> 地点壳
  presentation/          # 占位角色、交互目标、交互控制器（无规则）
  scenes/                # title / play（学堂占位地点）
  ui/app_theme.tres      # 全局主题：Noto Sans SC
  assets/fonts/          # 字体 + 授权清单（见其中 README.md）
  content/generated/     # 未来由 sync 脚本生成，禁止手改
  tests/                 # 冒烟检查与证据捕获，不进正式导出
```

- **入库**：`project.godot`、`.tscn`/`.gd`/`.tres`、`export_presets.cfg`、`assets/`、`content/`、`tests/`。
- **不入库**：`.godot/`（导入缓存，见 `godot/.gitignore`）、`export/`、`../artifacts/godot/`（导出产物）。
- 新克隆必须先跑一次 `--import`，否则 `res://assets/fonts/*.ttf` 等资源无法解析。

## 5. 当前边界（不要误读）

**已做**：真实原生窗口、中文字体渲染、键鼠焦点与移动、目标交互、面板开合、窗口缩放、最小 macOS 与 Web 导出。

**未做**：任何规则、数据、随机数、存档、真实事件与战斗。这些属于 W1–W3，由 `domain/`、
`application/`、`infrastructure/` 三层承接，本壳层不得自行长成第二份状态。
