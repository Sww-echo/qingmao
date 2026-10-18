# P2 架构承接：W0–W3

本任务承接已批准的 [最新设计](../10-18-godot-impl-redesign/design.md)、[协议](../10-18-godot-impl-redesign/contracts.md) 和 [验证矩阵](../10-18-godot-impl-redesign/validation.md)。旧架构计划仍为基线，冲突处以最新重设计为准。W0 已交付；W1 起按包实施和记录证据，不将计划当作成果。

- W0 先做可见原生窗口、中文占位学堂、移动/交互和最小桌面/Web结果，不等完整规则才第一次演示。
- W1 载入已冻结 V1 数据，源仍为 TS content.ts；同步副本在资源根内，严格校验和漂移检查；五套件及规范 JSON 字节等价、导出内容自检为硬门槛。
- W2 纯规则无场景依赖；复现 uint32 RNG，三黄金轨迹逐步骤完整比较，600 局比较动作与每步完整 State 哈希链（包括确定日志/账本/计数），不采用缩减投影。
- W3 GameSession 唯一持有状态，revision/命令去重/过期拒绝；SaveService 单写入快照、当前/备份、故障和恢复。保存失败显示未保存且保留内存，不重做动作。

精确引擎/模板已在 W0 锁定为 4.7.2.stable.official.ed1daf0bf；GDScript/Compatibility 为方案基线。Web持久化在 W3 单独验证，不继承桌面原子替换假设。首版不转换旧v2档。

P2不更改V1数值或做V2节奏实验。V1全量对照和存档接口通过后交P3；回退仅新工程/相关工具，保留TS参考与旧Web。
