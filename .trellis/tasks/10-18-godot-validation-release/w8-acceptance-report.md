# W8 验收报告（自动证据与平台阻塞）

日期：2026-10-21（Asia/Shanghai）。候选规则/内容基线 `406842f`；本轮只追加 W8 验收证据、
界面范围文案、窗口截图与测试超时修正，未改规则、内容或存档合同。

## 1. 结论

自动门槛已具备：规则套件、Node 工具、V1 跨引擎对照、V2 开发集/留出集、内容自检、
PCK 导出与包内自检均通过；720p/1080p 真实窗口截图已在当前 Linux/Xvfb 环境重新生成。
**不能据此宣称完整发布验收通过**：当前环境缺少 Godot 导出模板，无法生成可启动的
macOS/Web 正式包；没有可用 Chromium，浏览器保存/刷新/继续未复跑；真人键鼠、真实失焦、
高 DPI 与输入法仍未验收。最终结论是“自动证据与窗口证据就绪，平台与真人验收待补”。

## 2. 环境与源码

| 项 | 值 |
| --- | --- |
| 规则/内容基线 | `406842fe079a34632fd32b339870af1eea3cc690`（V1 对照时工作树干净） |
| Godot | `4.7.2.stable.official.ed1daf0bf` |
| OS / CPU | Ubuntu 24.04 LTS x86_64 / Intel Xeon Platinum 8255C，2 vCPU |
| Node / npm | `v24.18.0` / `11.16.0` |
| 渲染器 | `opengl3`（headless 对照）；Xvfb/llvmpipe（720p/1080p 窗口） |
| 内容哈希 | prototype `14ad9c82…e9f1`；V2 `70c04afb…0b0a` |

## 3. 自动执行证据

| 验证 | 结果 | 证据/产物 |
| --- | --- | --- |
| Godot 全部套件 | **6838 checks / 0 failures** | smoke 50、rng 75、canonical 40、codec 1760、content 91、rules 1273、v1 replay 3243、session 126、save 137、combat_v2 43 |
| Node 工具链 | **28/28 通过** | `npm run godot:test-tools`，含真实进程中断与版本/报告负例 |
| V1 跨引擎全量对照 | **600 runs / 53042 actions / 53642 states，PASS** | `artifacts/godot/v1-compare-all.json`；报告 SHA256 `90fa3e02…add3`；期望文件 SHA256 `7cf44e3f…66c2` |
| V2 平衡复跑 | 开发集与留出集均达门槛 | `artifacts/godot/w8/balance-all.json`；开发/留出 war-ready 100%、network 100%、labor 0%；后段非劳作 10/13/0；静态窗口两项 `true` |
| 场景控件 | war-ready 120、network 118、labor 118 checks，均 0 失败 | `play_flow` 三策略 |
| 其他 W5/W6/W7 回归 | title 31、reload 27、event_coverage 153、input 10、pack_switch 16、w7_save_failure 16、w7_ux 32，均 0 失败 | 对应 `tests/*.gd` |
| React 构建与单测 | 构建通过；**295/295 tests** | `npm run check` |
| 内容冻结/同步 | 5 个冻结文件、7 个 Godot 文件检查通过 | `content:validate`、`prototype:freeze -- --check`、`godot:sync-content -- --pack all --check` |
| 包内内容自检 | prototype 与 V2 均通过 | `godot --headless --path godot -- --verify-content` |
| PCK 导出 | Web/macOS PCK 各 13,546,884 bytes，SHA256 均 `6c8e0087…b8b5` | `artifacts/godot/w8/{web,macos}.pck` |
| PCK 探针 | 内容/清单存在，测试 runner 与 fixtures 已排除 | `export_probe.gd`：`Export resources verified` |
| 真实窗口 | 1280×720 与 1920×1080 事件/暂停截图及几何检查通过 | `artifacts/godot/w8/window/{720,1080}/` |

说明：V1 对照在规则/内容基线 `406842f` 上执行；之后的 W8 改动只有界面范围文案、
README、窗口截图、测试超时和任务文档。规则/内容的哈希与对照预期未变。

## 4. AC1–AC10 矩阵

| 父标准 | 当前状态 | 证据 | 未完成/限制 |
| --- | --- | --- | --- |
| AC1 完整真实试玩 | **部分** | 三策略场景控件整局、W7 模态/焦点自动化、W8 720p/1080p 截图 | 无真人键鼠完整局；无 macOS 实机 |
| AC2 两类策略 | **自动通过** | play_flow war-ready/network；V2 策略与平衡 | 真人输入未验 |
| AC3 机会成本 | **自动通过** | V2 开发/留出报告、行动分配、失败原因 | 可理解性未由真人验证 |
| AC4 成长/有效蛊/关系 | **自动通过** | W6 消融：drill、safe-route、有效蛊 | UI 与真人操作一致性未完整复看 |
| AC5 规则不可绕过 | **自动通过** | 6838 checks、session/save 负例、非法/过期拒绝 | 仍缺真实磁盘满/只读卷演练 |
| AC6 跨引擎一致 | **通过（V1）** | 600 局 53042 动作/53642 状态全等 | V2 不应与 V1 结果相同，不能外推 |
| AC7 保存恢复 | **自动通过** | save_faults 137、Node 中断 8 例、W7 失败重试 16 | 未做本机真实进程窗口重开；W5 窗口证据为该环境当时记录 |
| AC8 旧版隔离 | **部分** | codec/内容互拒、旧 React 构建与 295 测试通过 | Chromium 不可用，旧 E2E 未重跑；未宣称旧浏览器端已验证 |
| AC9 多种子报告 | **自动通过** | 开发 1–100、留出 20001–20100，全部结果入报告 | 留出集为已登记复跑，不再称首盲测 |
| AC10 Web 结果 | **阻塞** | 无 Web 导出模板、无可用 Chromium；W3 历史证据不能替代 W8 复跑 | 需安装模板并实测加载/刷新/保存/继续 |

## 5. 平台阻塞（可复现）

- 正式导出：
  `No export template found at .../export_templates/4.7.2.stable/web_nothreads_debug.zip`
  与 `.../macos.zip`。本环境没有 W0 记录中的模板目录；`--export-pack` 可成功，
  但它不是可启动的 macOS/Web 包。
- Web/Playwright：Playwright 配置找不到本机 Chromium；系统 Chromium snap 不可用。
  `npm run test:e2e` 在浏览器启动前失败，未运行任何旧版浏览器用例。
- 真实窗口：Xvfb 已可启动并重新生成 720p/1080p 截图；这仍不是真人键鼠或真实桌面环境。
- 真人验收：无参与者；单局时长、理解度、后段趣味、真实失焦、高 DPI、输入法均未测。

## 6. 下一步

1. 在目标平台安装锁定版本的 Godot 导出模板，重新执行 `--export-debug "macOS"` 与
   `--export-debug "Web"`，解压/启动后用 `--verify-content` 复验。
2. 准备可用 Chromium，运行 `npm run test:e2e`，并在真实浏览器完成保存→刷新→继续；
   若无结果，保留本报告的阻塞日志。
3. 用真实键鼠完成战备、借势、劳作三局及事件/战斗/日结重开，补 W7 结构化试玩记录。
4. 在上述环境重新跑一遍全量套件、`godot:compare -- --set all` 和 V2 留出集；
   当前报告只能作为 Linux 自动/窗口证据，不作为最终发布验收。
