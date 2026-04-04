# 前端显示与交互专项测试计划

## 目标

- 仅覆盖前端可见性与基础交互，不验证后端链路、数据库落库、模型调用或业务成功语义。
- 重点检查按钮、文字、弹窗、输入框、筛选器、标签页、空状态、loading、error、路由切换与基础键盘关闭行为。
- 现有真实烟测保留在 [`e2e/studio-smoke.spec.ts`](/Users/bytedance/Desktop/seeseezz/cozestudio/e2e/studio-smoke.spec.ts)，新增的前端专项覆盖集中在 [`e2e/studio-interactions.spec.ts`](/Users/bytedance/Desktop/seeseezz/cozestudio/e2e/studio-interactions.spec.ts)。

## 测试边界

- 测试页面：
  `/studio/playground`、`/studio/tools`、`/studio/dataset`、`/studio/settings`、`/studio/mapping-editor`、`/infinite-canvas`、`/infinite-canvas/editor/[projectId]`
- 测试方式：
  真实 UI 烟测 + Playwright 前端侧状态 mock
- 不测内容：
  接口返回值正确性、保存/删除/导出是否真实成功、数据库持久化、ComfyUI/AI Provider 调用、上传与生成任务是否完成

## Mock 策略

- 通用前端状态 mock 放在 [`e2e/helpers/ui-mocks.ts`](/Users/bytedance/Desktop/seeseezz/cozestudio/e2e/helpers/ui-mocks.ts)。
- 稳定渲染所需的只读测试数据放在 [`e2e/fixtures/ui-state.ts`](/Users/bytedance/Desktop/seeseezz/cozestudio/e2e/fixtures/ui-state.ts)。
- Mock 只负责把页面渲染到“可检查 UI”的状态，例如：
  历史记录面板有卡片、Mapping Library 有工作流、Dataset 有集合、Infinite Canvas 有项目和节点。

## 当前已覆盖

| ID | Route | 类型 | 断言重点 |
| --- | --- | --- | --- |
| UI-001 | `/` | 真实烟测 | 重定向到 Playground，Header 与主导航显示正常 |
| UI-002 | `/studio/playground` | 真实烟测 | 顶部导航切换 `Tools`、`Dataset`、`Playground` |
| UI-003 | `/studio/playground` | 真实烟测 | `Sign In` 弹窗打开、`Login/Register` tab 显示、`Escape` 关闭 |
| UI-101 | `/studio/playground` | Mock UI | `Gallery`、`Moodboards`、`History`、`Describe` 切换后控件与空态可见，旧面板不残留 |
| UI-201 | `/studio/mapping-editor` | Mock UI | Library 标题、搜索、Add Workflow 卡、工作流详情、删除确认弹窗显示 |
| UI-301 | `/studio/dataset` | Mock UI | 列表页标题与按钮、详情页进入返回、更多菜单项显示 |
| UI-401 | `/studio/tools` | Mock UI | Tool Grid 标题、工具详情、返回按钮、`Capture PNG`、`Record Video` |
| UI-501 | `/studio/settings` | Mock UI | `Settings` 面板、`Save Settings`、切到 `Workflow Mapper` 后嵌入壳体显示 |
| UI-601 | `/infinite-canvas` | Mock UI | 入口 loading 文案与 error/retry 状态显示 |
| UI-701 | `/infinite-canvas/editor/[projectId]` | Mock UI | 项目名、创建节点按钮、侧栏面板、自动保存提示、节点新增入口 |

## 后续建议

| 优先级 | 方向 | 说明 |
| --- | --- | --- |
| P1 | 响应式巡检 | 同一批 UI-only 用例补 tablet / mobile viewport |
| P1 | 键盘交互 | 补 `Tab`、`Shift+Tab`、`Enter`、`Escape` 的焦点与关闭行为 |
| P1 | 空态/错误态扩展 | Playground、Dataset、Mapping Editor 分别补零数据与 4xx/5xx 状态 |
| P2 | 视觉回归 | 如果后面要做样式稳定性回归，再单独引入 screenshot baseline |

## 说明

- 这套计划默认继续使用 Playwright，不引入新测试框架。
- 当前用例都是“前端专项”口径，页面只要能正确显示和切换，即视为通过；不会把断言升级成业务验收。
