# P2 架构承接：W0–W3

本任务承接 [最新设计](../10-18-godot-architecture-plan/design.md)、[协议](../10-18-godot-architecture-plan/contracts.md) 和 [迁移矩阵](../10-18-godot-architecture-plan/migration.md)，这些是本阶段的详细设计依据，尚未实现。

- W0 先做可见原生窗口、中文占位学堂、移动/交互和最小桌面/Web结果，不等完整规则才第一次演示。
- W1 载入已冻结 V1 数据，源仍为 TS content.ts；同步副本在资源根内，严格校验和漂移检查。
- W2 纯规则无场景依赖；复现 uint32 RNG，逐步比较完整 State（包括确定日志/账本/计数），不采用缩减投影。
- W3 GameSession 唯一持有状态，revision/命令去重/过期拒绝；SaveService 单写入快照、当前/备份、故障和恢复。保存失败显示未保存且保留内存，不重做动作。

精确引擎/模板在W0验证锁定；GDScript/Compatibility为方案基线。Web持久化单独验证，不继承桌面原子替换假设。首版不转换旧v2档。

P2不更改V1数值或做V2节奏实验。V1全量对照和存档接口通过后交P3；回退仅新工程/相关工具，保留TS参考与旧Web。
