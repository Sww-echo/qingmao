# W7 技术设计

## 1. 保存失败与重试

- `SaveService.flush_pending()` 在写入失败时保留 `_pending`（`stale-save` /
  `not-configured` / `superseded` 除外），并返回真实错误码。
- `GameSession` 只通过 `set_save_status(failed, savedRevision, code)` 更新投影；
  不重放动作、不推进 revision、不重复扣款。
- `main.gd` 负责“保存并返回/保存并退出/重试保存”：
  - 只有 `flush_pending().ok` 才切屏/退出；
  - 失败时调用 `play.report_save_result(false, code)`，暂停页保持打开；
  - 重试成功后调用 `report_save_result(true)`。
- 标题退出失败时，第二次点击才无保存退出，并明确文案。

UI 不直接读磁盘，也不自己计算合法性；按钮只发信号。

## 2. 长文与缩放

- 事件正文放入 `ScrollContainer`，固定最小高度并按视口扩展；选项与关闭按钮
  留在滚动区外。
- 720p 事件模态高度上调到能容纳标题、元信息、滚动正文、选项与关闭按钮。
- 1080p 沿用同一布局，`canvas_items` 拉伸；不另写大屏分支。

## 3. 键盘焦点

沿用现有模态白名单与 `focus_behavior_recursive`：
- 模态打开时 HUD 焦点禁用，首个可用控件获焦；
- 关闭时恢复打开前焦点，否则回落到日常行动；
- 战斗/事件/蛊/日结/结局/暂停各自有默认焦点。

## 4. 证据

- 自动：保存失败/重试 `tests/w7_save_failure.gd`；`save_faults` 增加 flush
  失败保留 pending 的用例；`input_robustness`、`play_flow` 保持全绿。
- 窗口：720p/1080p 截图与检查表；结构化试玩若无法组织则明确记录限制。
