# P1 修改前基线

日期：2026-10-18。以下在原型代码落盘前执行，Node.js v24.18.0 / npm 11.16.0。

## 依赖与构建

- 初次 `npm ci` 失败：现有 package-lock 缺少 lightningcss、rolldown 等包的跨平台 optional dependency 条目。
- 用 `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` 补齐，再 `npm ci --no-audit --no-fund` 成功。
- 锁文件复核：只新增30个 optional package记录（555行）；既有 package记录和顶层字段均未改变，没有依赖升级。
- `npm run check` 成功：TypeScript、Vite、离线 `dist/play.html` 均构建成功；13 个测试文件、264 项测试通过。

## 既有浏览器测试

执行 `npm run test:e2e -- e2e/fang.spec.ts --max-failures=1`：首条失败，另外四条因达到失败上限未运行。

- 失败位置：`e2e/fang.spec.ts:29`，寻找名称完全等于“开始方源篇”的按钮。
- 实际标题页按钮为“开始这一世”（`src/App.tsx`），页面快照与源码一致。
- 这是原型改动前已有的选择器/产品版本漂移，不是新规则回归。更多旧行为冲突已见父任务策略审计，未宣称所有浏览器测试通过。
- 本阶段不修改旧界面或用删除/跳过用例掩盖失败；在受影响的实际界面验收阶段修复该测试集。

失败附件位于被 Git 忽略的 `test-results/`；重跑命令可重新生成。这里只记录实际执行到的首个失败，不把静态发现冒充已执行失败。
