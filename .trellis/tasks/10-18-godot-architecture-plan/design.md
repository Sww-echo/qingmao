# Godot 架构设计

2026-10-18 · 方案，尚未实现。需求见 [prd.md](prd.md)，详细协议见 [contracts.md](contracts.md)。

## 1. 目标结构与依赖

采用仓库内并行 Godot 工程，GDScript 实现新试玩全部运行逻辑，不依赖浏览器、JS 虚拟机或 React WebView。

```text
输入 / Control / Node2D
          │ 查询投影 / 提交动作
          ▼
     GameSession（唯一状态所有者）
          │                    │ 保存快照
          ▼                    ▼
   Domain 纯规则           SaveService → 平台存储适配
          ▲
   ContentCatalog（启动校验后只读）
          ▲
   JSON 加载 / 生成流水线
```

- 表现依赖 application 的公开合同，application 依赖 domain 和注入的存储接口。
- domain 只依赖值对象、只读内容与确定性 RNG；不引用 Node、SceneTree、Input、FileAccess、系统时钟、平台 RNG 或资源加载。
- infrastructure 实现内容/存储适配，组合根连接它们；domain 不反向 import infrastructure。
- scene、信号接收者、动画、音效都不持有可修改的 GameState。节点销毁不改变规则。
- 不引入 ECS、通用任务脚本语言、插件总线或多个全局管理器。需求扩大时再拆系统。

## 2. 计划目录与文件责任

以下文件全部是未来目标，非现有实现；测试夹具副本必须放进资源根。

```text
godot/
  project.godot
  export_presets.cfg               # 无凭据的 preset；精确版本记录在工具链说明
  bootstrap/
    main.tscn / main.gd            # 唯一组合根，创建会话、加载目录、切换界面
  domain/
    model/game_state.gd            # 纯值数据、复制、整数与不变量
    model/game_action.gd           # 封闭动作类型、payload 解码
    model/rule_result.gd           # 新状态、结构化拒绝与规则事件
    content_catalog.gd             # 已校验、只读、稳定 ID 索引
    rules.gd                       # validate/apply 唯一入口
    rules/requirements.gd          # 条件；无 IO、无 RNG
    rules/effects.gd               # 有限效果；保留声明顺序
    rules/day_cycle.gd             # 供养、跨日、窗口、危机入口
    rules/combat.gd                # 敌意图/补给/撤退/结局
    queries.gd                     # 合法动作、上限、成本、机会、准备预览
    rng32.gd                       # V1 Mulberry32 明确 uint32 行为
  application/
    game_session.gd                # revision、提交、防重复、恢复与信号
    session_contracts.gd           # 应用结果和 ViewModel 的明确结构
    view_projector.gd             # 从状态/查询构建只读界面投影
    save_service.gd               # 保存队列、快照、加载验证、恢复策略
  infrastructure/
    content_loader.gd              # JSON → 严格校验 → Catalog
    state_codec.gd                 # state/envelope 解码、编码、版本检查
    desktop_save_store.gd          # 临时文件、备份、替换与错误
    web_save_store.gd              # 实测后适配站点存储及导入导出
  presentation/
    screen_router.gd               # title/play/ending；不写规则
    interaction_controller.gd      # 鼠标/键盘 → 稳定目标 ID
    modal_controller.gd            # 模态优先级、关闭和焦点恢复
    presenters/                    # ViewModel 绑定控件；无收益公式
  scenes/
    title.tscn / play.tscn / ending.tscn
    locations/academy.tscn / inn.tscn / bamboo.tscn
    panels/event.tscn / combat.tscn / day_review.tscn
  ui/                              # HUD、预览、蛊虫管理、风险、保存反馈
  content/generated/              # 生成，禁止手改；正式导出只带当前运行数据
  tests/                           # SceneTree runner、单元、回放与故障夹具
  assets/{art,fonts,audio}/         # 本地资产及授权清单
shared/
  contracts/                       # 已有 trace-v1；后续另建内容/存档协议
  prototype/                       # 已冻结 V1 的生成内容/manifest
  fixtures/prototype/              # V1 完整轨迹，保留
  scenarios/qingmao14-v2/           # V2 切换后才建立的内容唯一编辑源
scripts/                           # 资源同步、漂移检查、跨引擎比较、构建
```

`RefCounted` 可作为 domain 数据容器，但禁止场景生命周期依赖。不依赖引擎小版本才支持的高级泛型；实现时以被锁定版本的类型能力为准。JSON 边界允许 Dictionary，校验后转为类型化对象；不让未校验 Variant 流入规则。

## 3. 单一权威状态与生命周期

`GameSession` 由根场景拥有，不为每个地点新建；首版无需 Autoload 保存游戏状态。

```text
启动 → 检查内容/版本 → 标题（新局/继续/导入）
新局 → seed + Catalog → create_state → 持久化请求 → play
继续 → 检测档案 → 完整验证候选快照 → 一次安装 → play/ending
play → dispatch → 新状态 → 投影 → 交互/模态更新
ending → 结果与实际原因 → 返回标题/新局
```

新局种子可在应用边界生成一次后注入 domain，随后所有规则随机只来自存入状态的 RNG。正式玩家界面不展示未来随机状态。

| 状态类别 | 所有者/是否持久化 | 说明 |
| --- | --- | --- |
| 日期、行动、地点、资源、修为、关系、蛊/供养、旗标、暴露、事件、战斗、危机、结局、RNG | domain / 必须保存 | 已有 V1 State 全字段继承；不由节点缓存推导成另一份真相 |
| runId、revision、已保存 revision、内容摘要、最近命令去重缓存 | application / 按合同保存必要项 | 与 V1 规则状态分开，不参与规则对照 |
| 小场景角色位置、摄像机、滚动、动画、悬停、焦点 | presentation / 首版不存 | 读档回当前地点安全出生点；不改变收益与敌情 |
| 日期窗口机会、供养额、真元上限、可用蛊、准备条件 | query / 不存 | 从权威状态计算，避免读档后相互矛盾 |

不从 domain 再维护一个可编辑的“当前 UI 阶段”字段。表现模式按 `ending > combat > activeEvent > exploration` 推导；日结回顾是表现队列，不能遮盖下一步危机的权威状态。

## 4. 一次动作的完整顺序

1. UI 带 `runId + commandId + expectedRevision + action` 提交；立即锁定同一交互源。
2. 会话先检查异局/命令冲突；已处理的同一命令返回缓存结果，再检查过期 revision 或重入请求；通过后调用纯 `validate`。
3. 非法请求返回稳定 error code/可读原因；原状态、revision、RNG、日志和保存请求数不变。
4. 合法动作在隔离副本上 `apply`，校验结果不变量；异常不安装半成品。
5. 一次替换内存状态，revision 加一，构建投影与有序结果事件，记录命令处理结果。
6. 以这一 revision 的不可变快照请求保存，然后通知视图。存储完成另行回报；**无需等磁盘成功才能显示操作结果**，界面显示“保存中/未保存/已保存”。
7. 表现队列只播放通知、伤害与日结回顾；结束不会再发奖励。下一可接受输入依据会话当前状态，防止旧弹窗继续扣款。

保存失败后已完成的动作不回滚，保留内存进度并提供重试/导出；返回标题或退出前明确显示未保存。没有后台保存线程时也保持相同合同。应用不在信号回调里重入 dispatch。

## 5. 场景与输入

```text
Main (Node / 组合根)
├─ GameSession (Node，应用层)
└─ ScreenHost
   └─ Play (Node)
      ├─ World (Node2D)
      │  ├─ CurrentLocation (Node2D)
      │  │  ├─ Visuals
      │  │  ├─ Player (CharacterBody2D，占位角色)
      │  │  └─ Interactables (Area2D，只携带 targetId)
      │  └─ Camera2D
      └─ CanvasLayer
         └─ UI (Control / Containers)
            ├─ HUD + 地点入口 + 机会/准备清单
            ├─ 交互预览 / 蛊虫与补给管理
            ├─ ModalHost (事件 / 战斗 / 暂停)
            ├─ 日结回顾队列
            └─ 通知 / 保存状态
```

场景内移动只增加空间体验，不耗行动、不抽随机、无碰撞战斗；走到目标按 E/点击打开预览，也可通过键盘焦点选择该地点的交互列表。地点切换是 `TRAVEL`，先验证规则成功再切视觉场景；小场景出生点由地点提供。首版不做寻路/随机刷怪/隐形距离费用。

UI 先处理输入，打开模态后禁止世界移动与交互；不依赖全局 `SceneTree.paused` 才能保护规则。若使用树暂停，只暂停表现分支，会话和保存完成反馈必须可工作。Esc 在普通事件映射合法 `DISMISS_EVENT`；危机到达不可取消，战斗只通过合法撤退；暂停菜单不等于丢弃待决状态。

保持一个键盘焦点所有者。关闭管理页恢复来源控件；日结后先显示实际支出/休眠/机会关闭，再展示已到达危机。重载场景、调整窗口、跳过表现均不可提交额外动作。

布局采用 Control/Container，覆盖 1280×720、1920×1080 和窗口缩放；长事件滚动、按钮可达、中文本地字体。风险用文字与图形，不只用颜色。首版键鼠，不扩展手柄/手机范围。

## 6. 内容、场景和规则的边界

内容保存地点/蛊/事件稳定 ID、窗口、条件、成本和有序 effects；场景只保存视觉位置、碰撞、targetId 和资源引用。不在 `.tscn` 节点上另设收入、伤害、关系门槛。

交互目标表将 `academy.training` 等 ID 映射为动作或事件选择预览。机会列表可显示别处已知机会及地点；不能因为进入场景就结算“到访奖励”。复杂因果必须扩展有限 effect 并测试，禁止从 JSON 执行 GDScript。

首版只实现一个 14 日 scenario 的 Catalog/Rules 组合，不抽象所有青茅山篇章为万能插件。保留 scenarioId 和内容加载接口，未来增加正式章节时另立任务检验边界。

## 7. 关键取舍与风险处理

| 决策 | 原因 | 代价/验证 |
| --- | --- | --- |
| GDScript + Compatibility | 2D 与 Web 路径，降低多语言运行依赖 | 不把研究中的具体版本当可用安装；先本机运行/导出 |
| 规则全量复制后提交 | 首版状态小，易保证拒绝无副作用 | 若日志增长导致可测性能问题，再做不变量保持的优化 |
| V1 全字段逐步对照 | 避免将遗漏误判成迁移成功 | 保留确定日志/账本，后续 V2 可另定义本地化事件 |
| 原型冻结、V2 单语言继续 | 降低长期双实现漂移成本 | 新玩法在 Godot 测试/模拟，不复用旧 TS 胜率作结论 |
| 新旧工程并行 | 旧版可继续玩，可逐阶段退回 | 不承诺两个引擎共享存档或同步新增功能 |
| 占位资产先闭环 | 尽早看到真实玩法 | 不能将美术占位等同于玩法未接入 |

完整回退以工作包为边界：停在上一可运行 Godot 门槛或继续旧 Web；不 reset 全仓库、不覆盖旧档。版本与切换细节见 [migration.md](migration.md)。
