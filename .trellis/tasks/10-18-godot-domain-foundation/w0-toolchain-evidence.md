# W0 门槛证据：工具链与第一个可见窗口

2026-10-18 16:18–16:45 CST · 承接 [P2 执行入口](implement.md) W0 · 对应 [验证矩阵](../10-18-godot-architecture-plan/validation.md) V0。

本记录只覆盖 W0。P2-A–E 尚未全部达成；W1–W3 未开始。

## 1. 环境标识

| 项 | 值 |
| --- | --- |
| 源码标识 | `2752a11`（`codex/initial-import`），W0 改动提交前为 dirty |
| 引擎 | `4.7.2.stable.official.ed1daf0bf` |
| 渲染 | `gl_compatibility` → `OpenGL API 4.1 Metal - 91.7 - Compatibility - Using Device: Apple - Apple M4` |
| OS / CPU | macOS 27.0.1 (26A434) / Apple M4 / arm64 |
| scenario / rules / content / format | 工程内**尚无**这些版本字段；W0 不加载任何内容。V1 基准仍为 `qingmao-fourteen-day-prototype` / `prototype-rules-1` / `prototype-content-1` / format 1 |
| 内容摘要 | 不适用（W0 无内容） |

## 2. 工具链获取与校验

命令与结果：

| 步骤 | 命令（要点） | 退出码 | 结果 |
| --- | --- | --- | --- |
| 取官方校验和 | `curl …/SHA512-SUMS.txt` | 0 | 取得官方 SHA512 清单 |
| 下载编辑器 | `curl -L …/Godot_v4.7.2-stable_macos.universal.zip` | 0 | 170,622,178 字节，28.1 s |
| 下载模板 | `curl -L …/Godot_v4.7.2-stable_export_templates.tpz` | 0 | 1,281,349,702 字节，143.8 s |
| 校验编辑器 | `shasum -a 512` | 0 | `38aa16e5…bac69ca` = 官方值 |
| 校验模板 | `shasum -a 512` | 0 | `ca4d71c4…b84079` = 官方值 |
| 安装编辑器 | `cp -R Godot.app ~/Applications/` | 0 | `~/Applications/Godot.app`（337 MB） |
| 安装模板 | `unzip -q …tpz && mv templates …/export_templates/4.7.2.stable` | 0 | 35 个文件，含 `macos.zip`、`web_debug.zip`、`web_nothreads_debug.zip` |
| 版本确认 | `Godot --version` | 0 | `4.7.2.stable.official.ed1daf0bf` |

SHA256（供后续核对）：编辑器 `c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e`，
模板 `f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011`。

方案里被标记为「未经运行确认的 4.7.2 候选结论」现已**实际取得并校验**，不再是研究候选。
精确路径与运行命令写入 [godot/README.md](../../../godot/README.md)。

## 3. 工程与检查结果

| 检查 | 命令 | 退出码 | 结果 |
| --- | --- | --- | --- |
| 资源导入 | `Godot --headless --path godot --import` | 0 | 无错误；`NotoSansSC-VF.ttf`、`icon.svg` 导入成功 |
| 壳层冒烟 | `Godot --headless --path godot --script res://tests/run_all.gd` | 0 | **36/36 通过** |
| 原生窗口 | `Godot --path godot` | — | 真实窗口打开，Compatibility/Metal，窗口 1280×720 |
| 证据捕获 | `Godot --path godot res://tests/capture_w0.tscn -- --out=…` | 0 | 7 张 PNG |
| 缩放运行 | 同上，加 `--resolution 1920x1080` | 0 | 窗口 1920×1080，画面等比缩放，无裁切/错位 |
| macOS 导出 | `Godot --headless --path godot --export-debug "macOS" …zip` | 0 | 77,772,388 字节 |
| 产物启动 | 解压后运行包内可执行文件 | — | 进程存活，日志确认 Compatibility/Metal |
| Web 导出 | `Godot --headless --path godot --export-debug "Web" …/index.html` | 0 | `index.wasm` 37,902,138 / `index.pck` 13,317,892 字节 |
| Web 浏览器加载 | 本地静态服务 + 系统 Chrome（Playwright，无浏览器下载） | 0 | 见下 |

冒烟检查覆盖：渲染方式、720p 基准与 `canvas_items` 缩放、主题绑定、5 个输入动作及其按键绑定、
字体含 `青茅山蛊真元` 字形、标题场景实例化与信号、地点场景实例化、3 个交互目标 ID 唯一且非空、
状态行声明「架构演示」。

### 原生交互证据链（1280×720）

| 步骤 | 观测 |
| --- | --- |
| 标题画面 | 截图 `01-title.png`，采样到 17 种颜色 |
| 焦点按钮 + Enter | 屏幕由 `Title` 切到 `Play` |
| 地点画面 | 截图 `02-academy.png`，25 种颜色 |
| 按住 → 与 ↓ 20 帧 | 角色位移 `Δ=(28.28, 28.28)`（对角线归一化，方向正确） |
| 传送到 `academy.training` | 提示可见，文本 `按 E 查看「演武场」`（中文渲染正确） |
| 按 `E` | 说明面板可见 |
| 按 `Esc` | 面板关闭 |
| 鼠标左键点击目标 | 面板再次打开（鼠标路径同样可用） |

### Web 证据链

`status` 元素自动隐藏（引擎启动完成）；画布 1280×720；无 `pageerror`、无请求失败；引擎日志
`Godot Engine v4.7.2.stable.official.ed1daf0bf` + `OpenGL ES 3.0 (WebGL 2.0 …) - Compatibility` +
`Emscripten 4.0.20, single-threaded`。

浏览器内交互：标题画面采样 149 色 / 588 个亮采样；点击画布后按 `Enter`，画面变为学堂场景
（81 色 / 219 亮采样）。**画面确实变化**，说明 Web 构建不只是加载成功而是可操作。
选择无 threads 变体，因此不需要 COOP/COEP 响应头，普通静态服务即可。

## 4. 未测项（明确未验证，不得当作通过）

- **人工目视检查**：本轮执行环境没有图像查看能力，7 张 PNG 与 2 张 Web 截图只做了程序化检查
  （尺寸、颜色数、亮采样、运行期状态打印）。字形是否美观、排版是否舒服**未经人眼确认**。
- **非 720p 分辨率下的可读性**：只验证了 1920×1080 的等比缩放，未逐档检查字体清晰度。
- **系统级截图工具**：`screencapture` 与 `osascript` 被系统权限拒绝（无录屏/辅助功能授权），
  因此改用引擎内捕获。这属于执行环境限制，不是产品缺陷。
- **编辑器 GUI**：只跑了 `--import`，未打开编辑器界面。
- **Windows / Linux / 签名 / 公证 / 商店**：完全未涉及。
- **Web 持久化**：W0 无存档，未测浏览器存储与刷新恢复（属于 W3）。
- **帧率与性能**：未测。

## 5. 结论

W0 的退出条件（真实窗口打开、文字可读、角色能移动、目标能交互、桌面启动通过、Web 有实际结果）
在本机 macOS/Apple M4 上**已达成**，证据如上。这**不代表** P2-A–E 达成：规则对照、存档恢复、
后续场景可用的冻结会话接口都还没有。
