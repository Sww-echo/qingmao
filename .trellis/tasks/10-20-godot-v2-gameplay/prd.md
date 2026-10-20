# Godot V2 版本化内容与规则增量

> 2026-10-20 · W6 子任务 · 父任务 `10-18-godot-playable-slice`。
> 依据：[实现重设计](../../10-18-godot-impl-redesign/README.md)、[contracts.md](../../10-18-godot-impl-redesign/contracts.md)、
> [gameplay.md](../../10-18-godot-impl-redesign/gameplay.md)。

## 目标

在不改动 V1 冻结产物与跨引擎等价证据的前提下，接入 V2 内容源
（`qingmao14-v2` / `qingmao-rules-2` / `qingmao-content-2`），实现 D1–D5
规则增量、双端严格版本化校验和独立回归；V1 仍是安全网与对照基线。

## 需求

- V2 内容为手写权威源 `shared/scenarios/qingmao14-v2/content.json`：
  19 个 V1 事件复用 + 9 个新增事件，三敌人（`scout-wolf`、`crisis-pack`、`crisis-alpha`），
  新增 7 个参数，新增 `inquiry-unresolved` 暴露。
- Node 与 Godot 校验器按三元组路由：V1 走冻结校验器/镜像；V2 走独立 schema；
  未知三元组拒绝；V1 继续拒绝 V2 参数、第三敌人与 `next`。
- `godot:sync-content` 支持 `prototype`、`qingmao14-v2`、`all` 与 `--check`；
  V1 生成物字节不变。
- `ContentLoader` 可加载两个内置 pack；manifest 与内容哈希严格校验。
- `StateCodec` 按所选 catalog 校验敌人/暴露/旗标；V2 可恢复 `crisis-alpha`
  战斗与 `inquiry-due`，V1 仍拒绝。
- D1 盘问触发/未了结暴露、D2 庇护折扣与缺口补钱、D3 双阶段危机战、
  D4 演武先手、D5 加固减伤全部由内容参数驱动，引擎不写死数值。
- 公开视图/伤害预览与实际结算一致；拒绝路径无副作用、不消耗 RNG。

## 验收

| ID | 结果 |
| --- | --- |
| V2-A | 双端 V1/V2 版本路由与负例全绿；V1 冻结内容/夹具哈希不变 |
| V2-B | `godot:sync-content --pack all --check` 通过；V1 生成物逐字节不变 |
| V2-C | V2 内容可加载、阶段二战斗状态可保存/恢复；V1 拒绝 V2 状态 |
| V2-D | D1–D5 每条有正反用例；预览与实伤一致；拒绝无副作用 |
| V2-E | V1 九套件、V1 对照与 19 事件回归保持全绿 |

## 不在本任务

平衡调参、留出集 20001–20100 首跑、UI 新增、正式美术。这些属于 W6 后半或 W7/W8；
本任务先把版本化内容与规则增量做成可测、可回退的代码。
