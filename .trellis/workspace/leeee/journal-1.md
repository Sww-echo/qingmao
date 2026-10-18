# Journal - leeee (Part 1)

> AI development session journal
> Started: 2026-10-18

---



## Session 1: Godot W0：架构演示壳与工具链锁定

**Date**: 2026-10-18
**Task**: Godot W0：架构演示壳与工具链锁定
**Branch**: `codex/initial-import`

### Summary

按评审通过的架构方案开工 P2。锁定并校验 Godot 4.7.2-stable，建立并行 godot/ 工程，交付第一个可见原生窗口壳；未接入任何规则。

### Main Changes

- P1 收尾提交已由并行会话完成并推送，本轮核验提交内容完整、工作树干净
- 下载并安装 Godot 4.7.2-stable 编辑器与导出模板，SHA512 与官方清单逐字节一致
- 新建 godot/ 并行工程：Compatibility + GDScript + 1280x720 基准 + canvas_items 缩放
- 组合根 + 标题 + 学堂占位地点 + 占位角色 + 三个带稳定 target_id 的交互目标，全部只做表现、不持有规则状态
- 打包 Noto Sans SC（OFL-1.1）并附授权清单；系统中文专有字体不能随仓库分发
- 新增壳层冒烟检查 36 项与引擎内截图证据捕获（系统录屏权限不可用）
- macOS 与 Web 最小导出实测，tests/* 排除在正式导出之外

### Git Commits

| Hash | Message |
|------|---------|
| `1dc113f` | (see git log) |

### Testing

- [OK] godot --headless --path godot --script res://tests/run_all.gd → 36/36 通过
- [OK] 原生窗口：Compatibility/Metal、1280x720、角色移动、热点提示、E/Esc 面板、鼠标点击、1920x1080 缩放
- [OK] macOS 导出 77,772,388 字节，从包内 .app 启动成功
- [OK] Web 导出在系统 Chrome 中加载并交互，标题页 → Enter → 学堂场景
- [OK] npm test 仍为 295/295 通过（TS 侧未改动）

### Status

[OK] **Completed**

### Next Steps

- W1：内容/模型/生成合同与漂移检查，确认导出资源包含 JSON 与字体
- W2：Rng32 → 查询 → 资源/事件/日结 → 战斗/危机的纯规则等价迁移，三黄金轨迹后 600 局逐步全状态对照
- W3：GameSession、独立 SaveEnvelope、故障注入与恢复
