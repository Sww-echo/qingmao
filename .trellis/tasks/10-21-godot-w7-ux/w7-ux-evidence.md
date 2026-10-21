# W7 体验收敛与保存失败路径证据

日期：2026-10-21（Asia/Shanghai）。基线 `4015d5b`。
本记录覆盖 W7 的保存失败/重试、长文滚动、键盘焦点与 720p/1080p 窗口检查；
规则和内容未改。

## 1. 保存失败与重试

- `SaveService.flush_pending()` 写入失败时保留 `_pending`，新增 `has_pending()`；
  `stale-save` / `not-configured` / `superseded` 不重试。
- `main.gd` 的“保存并返回标题 / 保存并退出 / 重试保存”只有在 flush 成功后才
  切屏或退出；失败时留在游戏内并打开暂停页说明。
- 标题退出失败时二次确认，第二次点击才无保存退出。
- 暂停页新增“重试保存”，仅失败时可用。

验证：

```sh
GODOT_BIN=/root/Applications/godot-dl/Godot_v4.7.2-stable_linux.x86_64
"$GODOT_BIN" --headless --path godot --script res://tests/run_all.gd
"$GODOT_BIN" --headless --path godot --script res://tests/w7_save_failure.gd
```

| 验证 | 结果 |
| --- | --- |
| 全部 10 套件 | 6838 checks / 0 failures（save_faults 137） |
| `w7_save_failure` | 16 checks；失败不离开、快照保留、重试成功、继续重载 revision 1 |
| 失败副作用 | 动作只结算一次；失败不重放、不重复扣款 |

## 2. 长文与缩放

- 事件正文改为 `ScrollContainer`，固定最小高度；选项与关闭按钮留在滚动区外。
- 真实窗口截图（Xvfb + Compatibility/llvmpipe）：

```sh
GODOT_BIN=/root/Applications/godot-dl/Godot_v4.7.2-stable_linux.x86_64
DISPLAY=:111 "$GODOT_BIN" --path godot --resolution 1280x720 \
  --script res://tests/capture_w7.gd
DISPLAY=:111 "$GODOT_BIN" --path godot --resolution 1920x1080 \
  --script res://tests/capture_w7.gd
```

| 分辨率 | 事件模态矩形 | 滚动区矩形 | 结论 |
| --- | --- | --- | --- |
| 1280×720 窗口 | (260,80) 760×560 | (284,187) 712×274 | 完整在视口内，正文可滚动 |
| 1920×1080 窗口 | (260,80) 760×560 | (284,187) 712×274 | 同一 1280×720 内容坐标经 canvas_items 等比放大；截图为 1920×1080 |

截图在 /tmp/w7-shot/（工作区外，未入库）：`crisis-1280x720.png`、`crisis-1920x1080.png`、
`pause-720.png`。
`w7_ux` 在两种视口下断言事件模态、滚动区、选项与关闭按钮都在视口内。

## 3. 键盘与焦点

- `tests/w7_ux.gd` 对事件、蛊、战斗、日结、结局与暂停逐一 Tab 32 次，焦点必须
  始终留在 `ModalLayer`。
- 暂停期间强制把焦点放到 HUD 仍不能提交动作（W5 输入韧性复用）。
- 模态关闭后恢复到打开前控件；没有原控件时回落到日常行动。
- `play_flow`、`input_robustness`、`reload_flow` 保持全绿。

## 4. 结构化试玩

本轮没有真人参与者。自动化窗口输入与 headless 断言不等同真人试玩；
单局时长、理解度、后段趣味仍需 W7 后半或 W8 前补一次真人记录。

## 5. 未测 / 风险

- 未在 macOS 原生窗口复跑本轮 W7（Linux Xvfb/llvmpipe 截图）；最终平台证据仍属 W8。
- 未测真实失焦（切换应用）、高 DPI、浏览器缩放与输入法。
- 长文滚动仅用 V2 危机事件验证；全部 28 事件未逐一在窗口内滚动检查。
- 标题/结局返回路径现在都先 flush：保存失败会留在游戏/标题并给出重试或二次确认。
- 保存失败路径用注入 FaultStore 覆盖，未做真实磁盘满/只读卷演练。
