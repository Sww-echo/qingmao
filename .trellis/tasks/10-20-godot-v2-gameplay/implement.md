# V2 执行计划

## 1. 内容与校验

- [x] 新增 `shared/scenarios/qingmao14-v2/content.json`（28 事件/3 敌人/40 参数）。
- [x] Node：`validateGodotContent` 按三元组路由；V2 schema + 负例。
- [x] Godot：`ContentValidation` 增加 V2 分支；V1 分支保持冻结。
- [x] 双端负例：V2 配 V1 schema、V1 伪加 V2 参数/敌人/next、缺参/越界、
  未知引用、无生产者/伪造保留旗标、next 缺目标/成环。

## 2. 同步与加载

- [x] `godot-sync-content.mjs` 支持 `--pack prototype|qingmao14-v2|all` 与 `--check`。
- [x] `ContentLoader` 按 pack 读取 manifest/版本，校验 1 或 4 个文件记录。
- [x] `StateCodec` 按 catalog 版本接受 V2 敌人/暴露/`inquiry-due`，V1 继续拒绝。

## 3. 规则 D1–D5

- [x] D1 盘问触发、未了结暴露、只加一条、第 14 日不新触发。
- [x] D2 需求折扣、缺口补钱/上限/石头不足、ledger（combat_v2）。
- [x] D3 阶段切换、喘息封顶、护体清零、药酒合计、阶段二意图。
- [x] D4 drilled 先手/回退普攻/真元不足；不额外回合。
- [x] D5 turn=0/1/2、普通战、阶段二、预览实伤一致。

## 4. 测试与证据

- [x] `content_validation`：两 pack 正例 + V2 负例（91 checks）。
- [x] `state_codec`：V2 阶段二/盘问暴露往返；V1 拒绝（1760 checks）。
- [x] 新增 `combat_v2` 套件并加入 runner（43 checks，含 V2 动作解码回归）。
- [x] V1 九套件、play_flow、event_coverage、reload_flow 全绿（6831 checks）。
- [x] V2 场景控件流程（`QINGMAO_FLOW_PACK=qingmao14-v2`）三策略各跑到结局。
- [x] `--pack all --check` 与 `git diff` 证明 V1 生成物未变。
- [x] V2 专用策略（`v2_policies.gd`）与平衡报告器（`v2_balance.gd`）。
- [x] 开发集 1–100 × 3 达门槛：war-ready/network 100%、labor 0%、后段非劳作 10/13/0（≥9）。
- [x] 消融：drilled（war 后段 10→7）、safe-route（network 100%→0%）、
  有效蛊（network 100%→0%）。
- [x] 留出集 20001–20100 运行前登记、首跑一次并记录（结果不修改策略）。
- [x] 证据 `w6-v2-content-rules-evidence.md`。

## 5. 门槛与回退

- 退出：双端 V2 校验、D1–D5、V1 回归全部通过；V1 哈希不变。
- 回退：关闭 V2 pack 即回 V1；不改 V1 内容/夹具/对照。
- 已加开发启动参数 `--pack=qingmao14-v2`，未新增标题控件。
- 明确不做：平衡调参、留出集首跑、专门 UI 新控件（这些在 W6 后半/W7）。
