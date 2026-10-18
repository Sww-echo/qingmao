# W1 门槛证据：数据合同与内容管线

2026-10-18 · 承接已批准的 [实现方案 W1](../10-18-godot-impl-redesign/implement.md)。
用户要求“先提交再按任务开始实施”；规划先提交为 `6a53b6e`，随后通过 `task.py start`
激活本任务。本轮只实施 W1，不声称 W2 规则等价或 W3 存档已完成。

## 1. 环境与内容

| 项 | 值 |
| --- | --- |
| 基线提交 / 分支 | `6a53b6e` / `codex/initial-import`；W1 为工作树改动 |
| Node | `v24.18.0` |
| Godot | `4.7.2.stable.official.ed1daf0bf` |
| 渲染 | Compatibility；沿用 W0，不改场景布局 |
| scenario | `qingmao-fourteen-day-prototype` |
| rules / content | `prototype-rules-1` / `prototype-content-1` |
| content SHA256 | `14ad9c82d896da3ebe7d472d7d92f5594f403984c8decaf4e9bf7e477ec9e9f1` |

## 2. 实施边界

- 新增纯 `GameState` / `GameAction`、uint32 Mulberry32、规范 JSON/SHA256、
  严格 state codec、V1 内容目录与完整 schema/依赖图/monotone 审计。
- 新增版本路由、同步/只读漂移检查、源/目标哈希清单，复制冻结内容与三条轨迹的原始字节。
- W0 的 36 项冒烟拆入 suite，runner 支持五套件过滤与 0/1/2 退出码。
- 组合根增加内容加载与 `-- --verify-content`，两个导出 preset 显式包含 JSON、排除 tests。
- W1 只建立实际使用的数据类与基础设施；`application/` 留给 W3，未增加无行为 Session/Save 占位类。
- 未改 `src/`、`shared/`、锁文件、依赖版本、旧 Web 或 W0 场景。

## 3. Godot 套件

命令（`Godot` 指上述锁定安装）：

```sh
npm run godot:sync-content
Godot --headless --path godot --editor --quit
Godot --headless --path godot --script res://tests/run_all.gd
```

首轮全套件退出 0，结果：

| 套件 | 检查数 | 关键断言 |
| --- | ---: | --- |
| smoke | 36 | 原 W0 场景、输入、中文字体与交互目标保持 |
| rng_vectors | 75 | 4 种子前 3 次状态/分子/浮点值，低32位乘法边界 |
| canonical_json | 40 | 安全整数、空值/字符串/数组、Node 数字键枚举、分块 SHA256、冻结内容原字节等价 |
| state_codec | 1751 | 全271状态、265动作往返；14类行动、严格字段/枚举/引用/数值负例及副本隔离 |
| content_validation | 73 | 冻结 V1、35+负例、依赖/窗口/OR分支/monotone正反例、loader自检 |
| **合计** | **1975** | **0 失败** |

codec 往返不是 Godot 规则重放。三条轨迹包含的动作仍只由 TS 执行；W2 才做逐步等价。

额外验证未知套件与重复 `--suite` 均退出 2；分离参数 `--suite smoke` 可用。
独立复审补上缺少生成内容/夹具的环境前置检查，避免错误归类为断言失败。

## 4. Node 与冻结基线

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 构建通过；14 文件 / 295 项测试通过 |
| `npm run prototype:freeze -- --check` | 5 个冻结文件无漂移 |
| `npm run content:validate` | 源、生成内容与冻结清单通过 |
| `npm run prototype:replay` | 90 / 94 / 81 步，逐步状态一致 |
| `npm run prototype:simulate -- --set development --verify --out artifacts/godot/w1-development-baseline` | 300 局通过；war-ready/network 100%，labor 0%，仅作旧基线回归 |
| `npm run godot:validate-content` | V1 版本路由及冻结校验通过 |
| `npm run godot:sync-content -- --check` | 5 个 Godot 文件无漂移，退出 0 |
| `npm run godot:test-tools` | 生成副本/源哈希/只读检查/CLI/畸形输入回归，见 §6 最终复测 |
| `task.py validate 10-18-godot-domain-foundation` | 上下文路径验证通过 |
| `git diff --check` | 通过 |
| `git diff --exit-code -- src shared package-lock.json` | 无产品参考源或冻结产物变化 |

漂移实验在工具测试的隔离临时根目录进行：生成后在目标 JSON 尾部实际追加一个空格，
`check` 必须失败；对比失败前后所有目标文件哈希一致，证明没有偷偷修复；
显式同步后恢复一致。另覆盖缺目录不创建、缺夹具、改 manifest、额外文件与坏源哈希。

未运行留出集；没有以 W1 的工作重新调参或刷新冻结夹具。

## 5. 导出验证

```sh
Godot --headless --path godot --export-debug macOS ../artifacts/godot/w1/macos/qingmao-demo.zip
Godot --headless --path godot --export-debug Web ../artifacts/godot/w1/web/index.html
```

两个命令退出 0。macOS zip 用 `ditto -x -k` 解压，从 `/tmp` 工作目录运行包内
`青茅山 · 架构演示.app/Contents/MacOS/青茅山 · 架构演示 --headless -- --verify-content`：
退出 0，打印 prototype / prototype-content-1 及 §1 的 SHA256。
此执行不从仓库 `res://` 读取内容。

额外用编辑器 `--main-pack <实际导出pck> --script <绝对路径>/godot/tests/export_probe.gd`
分别读取 macOS 和 Web PCK：均退出 0，确认 `content.json` / `manifest.json` 存在，
test runner 与三个 fixture 文件不存在。外部 probe 自身不随导出包发布。

这证明双包资源包含/排除及 macOS 原生包内内容自检；**不证明本轮 Web 浏览器加载、
持久化、刷新恢复或真人操作**。W0 原有浏览器证据保留，W3 另做持久化实测。

## 6. 独立复审与最终复测

按 Trellis 流程分两个 implement 子代理实施纯数据/内容与 codec，再由独立 check 子代理
复审全范围，主会话负责同步、组合根、导出、规范和证据。

复审修复：

1. Node V1 委托遇畸形字段对象可能在冻结校验器内部抛异常；适配器返回错误数组并限制嵌套深度，不改冻结校验器。
2. runner 缺少已同步输入时应退出 2；增加资源前置检查与进程级回归。
3. manifest 所有哈希字段必须为64位小写十六进制；运行时仍不读取测试夹具。

修复后的最终复测：

| 检查 | 最终结果 |
| --- | --- |
| 五套件完整 runner | 1975 检查，0 失败，退出 0 |
| `GODOT_BIN=/Users/leeee/Applications/Godot.app/Contents/MacOS/Godot npm run godot:test-tools` | 8/8 通过，无跳过；含真实 Godot 进程的缺输入退出2、断言退出1、无运行时夹具成功及四类坏hash拒绝 |
| `npm run check` | 构建与295项测试再次通过 |
| sync `--check` / 源码边界 / diff空白 / task上下文 | 全部通过；implement/check 各10条上下文 |
| 项目普通无头启动 `--quit-after 2` | 退出0，无脚本错误 |
| 修复后重新 macOS / Web 导出 | 两者退出0 |
| 最终 macOS 包内 `-- --verify-content`（`unpacked-final/`，工作目录 `/tmp`） | 退出0；内容SHA与§1一致 |
| 最终 macOS / Web PCK 外部 probe | 两者退出0，内容在包内且测试资源排除 |

独立复审无剩余 W1 问题。新规约写入
`.trellis/spec/frontend/godot-foundation.md`，后续任务上下文已引用。
W1 gate 已通过；实现仍为未提交工作树，不自动推送或归档整个 P2。

## 7. 未测与下一步

- W2 尚未实施：requirements/effects/日结/战斗/查询、三策略移植与 600 局跨引擎哈希链。
- W3 尚未实施：会话命令、去重/revision、独立存档、逐步中断恢复和 Web 持久化。
- V2 schema、内容与 D1–D5 全部保留到 W6；当前显式拒绝 V2/all，不作静默降级。
- 未新做窗口截图、真人试玩、Windows/Linux、签名/公证或性能测量。
- P2 继续保持 `in_progress`，不归档、不将 W1 当作 P2-A–E 全部完成。
