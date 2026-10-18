# W2 门槛证据：V1 规则与跨引擎等价

2026-10-18 · 承接已批准的 [实现方案 W2](../10-18-godot-impl-redesign/implement.md)。
本包在 W1 数据/内容地基上实现纯 V1 规则、查询、三策略与逐步对照。用户已授权
“先提交再按任务开始实施”并持续要求继续实施；本证据记录 W2 实际运行结果，
不把规则等价等同于 W3 存档或 W4 起可见试玩。

## 1. 环境与版本

| 项 | 值 |
| --- | --- |
| 分支 | `codex/initial-import` |
| 前置规划提交 | `6a53b6e` |
| W0 / W1 | 已交付；W1 实现随本包待提交 |
| Node | `v24.18.0` |
| Godot | `4.7.2.stable.official.ed1daf0bf` |
| 主机 / 渲染 | Apple M4 / arm64 / macOS；Compatibility |
| scenario | `qingmao-fourteen-day-prototype` |
| rules / content | `prototype-rules-1` / `prototype-content-1` |
| content SHA256 | `14ad9c82d896da3ebe7d472d7d92f5594f403984c8decaf4e9bf7e477ec9e9f1` |
| 预期全集 SHA256 | `7cf44e3fc6075ccfb108e6f3f43ac251405fc1962060c547ec9e9d52bf1f66c2` |
| 对照报告 SHA256 | `df7893562a2e695d010da1cabe52721d8086a5e285862a0fc82ee70023cc5d70` |

## 2. 实施内容

- `domain/rules/requirements.gd`、`effects.gd`、`day_cycle.gd`、`combat.gd`
  分别承接行动校验、效果顺序、日结与战斗/Crisis；`domain/rules.gd` 只编排已校验的
  深克隆，`domain/queries.gd` 提供公开视图、合法动作、战斗预测与文案。
- `GameState.clone()` 与 `to_data()` 覆盖全部字段及数组顺序。接受动作在克隆上结算；
  拒绝动作不克隆、不抽随机数，也不追加日志/账本/计数。
- `tests/policies/v1_policies.gd` 仅消费公开视图与内容目录，移植 war-ready / network /
  labor 三策略及摘要；测试与批量比较共用同一策略实现，不另写一套“近似规则”。
- `tests/suites/rules_unit_suite.gd` 覆盖七种需求、十四类行动的拒绝路径、事件窗口、
  公开视图隔离、免费移动、无/有地听草侦查、供养/休眠/封存、最终日不恢复、
  成长上限、战斗顺序、药酒、撤退、死亡原因与庇护结算。
- `tests/suites/v1_replay_suite.gd` 对三条 seed42 黄金轨迹逐步比较策略动作和完整状态。
- `scripts/godot-v1-compare.mjs` 用冻结 TS 生成动作序列、初态及每步完整状态哈希、
  终局摘要和累计动作/状态哈希链；`tests/v1_compare.gd` 流式重放，先比动作再比状态/
  链/摘要，不保留整批 600 局快照。
- `scripts/prototype-replay.mjs -- --seed --policy --dump` 为开发诊断入口，输出先经
  冻结 TS 逐步骤验证；参数必须成组提供，不能与 `--file` 混用。
- 首差报告保留 runId、步号、动作、期望/实测哈希与实测完整值；Node 再导出该局 TS
  全轨迹并定位首个 JSON 路径。人为损坏动作、状态哈希、链哈希和完整日志均有测试。

## 3. Godot 套件

```sh
Godot --headless --path godot --script res://tests/run_all.gd
```

退出码 0，结果：

| 套件 | 检查数 | 结果 |
| --- | ---: | --- |
| smoke | 36 | 通过 |
| rng_vectors | 75 | 通过 |
| canonical_json | 40 | 通过 |
| state_codec | 1751 | 通过 |
| content_validation | 73 | 通过 |
| rules_unit | 1268 | 通过 |
| v1_replay | 3243 | 通过 |
| **合计** | **6486** | **0 失败** |

`v1_replay` 三条轨迹合计 90 + 94 + 81 = **265 次动作**。每一步都先比较
`V1Policies.choose(public_view)` 与冻结动作，再以 `Rules.apply` 执行并比较完整
camelCase 状态，包括日志、账本、动作计数、RNG 状态/次数和结局。终态与摘要另行比较。

## 4. 三策略独立与 600 局对照

命令与结果：

| 命令 | 局数 | 动作 | 完整状态（含初态） | Godot 耗时 | 结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| `npm run godot:compare -- --set development` | 300 | 26,522 | 26,822 | 57.07 s | 通过 |
| `npm run godot:compare -- --set holdout` | 300 | 26,520 | 26,820 | 61.06 s | 通过 |
| `npm run godot:compare -- --set all` | **600** | **53,042** | **53,642** | **112.65 s** | **通过** |

开发集为 1–100，留出集为已登记的 10001–10100；每集均跑
war-ready / network / labor。以上均用锁定 Godot 与 `GODOT_BIN`，实际对照一次完成，
不是把单独两轮数字相加冒充 `all`。

比较要求以下全部相等：初态及每步完整状态哈希、累计链、策略动作、终局摘要、
三元版本和 content SHA256。报告只在退出 0 且 `ok:true`、run/action/state 数与
预期文件及内容版本全部吻合时通过；脚本先删除旧报告，避免陈旧成功误判。

证据文件在 gitignored 的 `artifacts/godot/`：

- `v1-expected-all.json`：600 局动作、状态哈希链与摘要；
- `v1-compare-all.json`：Godot 实测报告、版本、哈希与耗时。

## 5. 边界与负向验证

`rules_unit` 的独立分支包括：

- TRAVEL 在行动数为 0 时仍合法且不消耗 RNG。
- SCOUT 无地听草也合法；先抽风险，只有进入遭遇时才抽敌人生命。
  清醒且装备的地听草直接给 2 情报，不抽风险、不留暴露。
- 最终日 `END_DAY` 先全付/全不付供养，然后进入危机选择；生命、真元、疑心、
  行动数和次日义务都不重置。
- 合法动作返回深克隆；查询返回的资源、蛊、事件、旗标和日志均不别名。
- 非法动作与需求查询前后完整状态、输入动作、RNG、日志、账本和计数不变。
- 战斗预测在防守后按当前护体重新计算实伤，意图不变；击杀不反伤；侦查胜利无
  巡山奖励；危机撤退死亡；结算 reason 顺序固定。

## 6. 首差诊断实测

1. `prototype-replay --seed 42 --policy <policy> --dump` 三次均与冻结 seed42
   文件逐字节一致，证明诊断轨迹不是另一套实现。
2. 在隔离临时目录对期望动作、状态哈希、累计链分别篡改一笔，真实 Godot
   进程均在 `development/war-ready/1` 第 1 步退出 1，并保留首个差异。
3. 对完整状态日志文案制造一笔错误，Node 定位到
   `$["log"][0]["message"]`，保留两端值并导出该局完整 TS 轨迹。
4. 缺失 1 个 run、错误 CLI 参数、重复参数和缺失 cohort 均退出 2；
   配置错误不会覆盖 expected 输入，残留旧成功报告不会被读取。

## 7. 工具、旧基线及导出

| 命令 | 结果 |
| --- | --- |
| `GODOT_BIN=… npm run godot:test-tools` | 16 / 16 通过（含真实 Godot 进程） |
| `npm run check` | 构建通过；14 文件 / 295 项测试通过 |
| `npm run prototype:freeze -- --check` | 5 个冻结文件无漂移 |
| `npm run content:validate` | V1 源、生成内容、清单通过 |
| `npm run prototype:replay` | 90 / 94 / 81 步通过 |
| `npm run godot:sync-content -- --check` | 5 个 Godot 副本无漂移 |
| `git diff --check` | 通过 |

macOS 导出成功。解压后从 `/tmp` 直接运行包内可执行文件：

```text
Content verified: pack=prototype contentVersion=prototype-content-1
contentSha256=14ad9c82d896da3ebe7d472d7d92f5594f403984c8decaf4e9bf7e477ec9e9f1
```

## 8. 未测范围与结论

- 尚未把规则接入可见场景；运行窗口仍是 W0 壳，不能声称 W4/W5 的真实键鼠试玩完成。
- GameSession、命令去重、存档事务、备份恢复与 Web 刷新持久化属于 W3，本包未实现。
- 三策略等价只证明冻结策略行为与规则一致，不证明策略最优、真人可理解或玩法平衡。
- V2 的 D1–D5、新内容、平衡门槛与留出评估属于 W6；本包未改 V2 schema。
- 只验证 macOS 包内容自检；W2 不新增 Web 运行行为，Web 持久化结论留给 W3。
- 无头比较不能替代真实窗口输入、画面、字体、焦点与音效验收。

W2 门槛（V4、V5、V6 的 V1 部分）已满足；下一步是 W3 会话与独立存档。
