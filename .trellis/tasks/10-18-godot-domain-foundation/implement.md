# P2 执行入口

状态 in_progress。W0/W1/W2 已交付；2026-10-18 用户批准 [最新实现重设计](../10-18-godot-impl-redesign/README.md)，要求先提交规划再开工。规划提交 `6a53b6e` 后实施 W1/W2 并通过门槛；2026-10-19 W3 自动门槛已验证，P2 待交接评审，不跨越到 W4。

执行 [详细工作包 W1–W3](../10-18-godot-impl-redesign/implement.md)，检查 [验证矩阵](../10-18-godot-impl-redesign/validation.md)。顺序不可倒置：

1. W0 已完成：见 [工具链证据](w0-toolchain-evidence.md)，36/36 冒烟与最小双导出。
2. W1 已完成：模型/RNG/规范 JSON/codec/严格 V1 内容校验、同步与漂移检查、五套件1975检查、双包资源及 macOS 内容自检；见 [W1 证据](w1-contracts-evidence.md)。实现随 `eef1920` 提交。
3. W2 已完成：requirements/effects→日结→战斗/危机→查询、三策略，三黄金轨迹逐步全状态、600 局动作及哈希链对照；见 [W2 证据](w2-equivalence-evidence.md)。
4. W3 已实施并验证自动门槛：GameSession、独立SaveEnvelope、8个真实进程中断点、4个黄金恢复点、原生跨进程继续、Web 保存刷新继续、冻结P3接口。见 [W3 证据](w3-session-save-evidence.md)。P2 等待交接评审，不自动归档或跨入 W4。

W3 粗估2–3人日，非日期承诺。每包输出命令/版本/日志与未测范围；W1/W2 证据已分别落盘，不能把 W0 壳层或无头规则对照视作存档/可见试玩完成。

退出：P2-A–E证据齐全。失败按包回退，不修改V1期望掩盖差异；适用规范按已验证结果写回，再按workflow处理提交和交接。
