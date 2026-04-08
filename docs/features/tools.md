# Tools

## 背景

Tools 提供独立于 Playground 的实时视觉工具（shader/three/canvas/DOM-SVG 合成等），支持参数调节、预览渲染、导出 PNG/录制视频，并可将参数方案沉淀为可复用的 preset。

## 模块职责

- 提供工具列表与单工具编辑视图（网格页 -> 工具详情页）。
- 提供参数编辑面板与 preset 管理（保存、加载、删除）。
- 提供渲染与导出能力（实时渲染、截图导出、录制视频）。
- 提供媒体输入上传（如工具需要图片/视频输入）。

## 核心流程

### 入口与页面结构

- 路由入口：`/studio/tools`。
- `ToolsView` 负责工具列表与单工具编辑页之间的切换。

### 参数与渲染

- 工具注册表提供工具的参数 schema 与渲染类型（shader/component/adapter）。
- 参数面板实时更新参数状态并驱动渲染层更新画布。

### Preset 沉淀

- 保存 preset：前端组合参数与缩略图后调用 `/api/tools/presets` 写入，服务端持久化字段使用 `tool_id`。
- 读取 preset：进入工具或切换 preset 时拉取并回放参数。
- 媒体类型参数在保存 preset 前需要先上传到 `/api/upload` 并落成可复用 URL，不能保留 `blob:` 本地地址。

### 导出

- 导出 PNG/录制视频以浏览器本地行为为主，不默认入库（以当前实现为准）。
- 详情页导出目标分辨率统一为 `3840x2160`，component 类工具也应按固定渲染尺寸输出，而不是直接使用当前屏幕像素尺寸。
- 非 canvas 渲染型工具可以不支持当前导出链路，UI 需要显式给出限制提示，避免用户点击后才发现失败。

## 输入 / 输出

### 输入

- 选择的工具 id。
- 参数面板输入（数值、开关、颜色、文本等）。
- 可选媒体输入（上传图片/视频/SVG 等）。

### 输出

- 实时预览画布渲染。
- preset（服务端持久化）。
- 导出的 PNG/视频文件（本地下载）。

## 依赖关系

### 前端依赖

- Tools UI：ToolsView、ParameterPanel、tool-configs 与各类 adapter/renderer。
- 渲染依赖：WebGL/Three.js/2D Canvas 等（以当前工具实现为准）。
- 上传依赖：preset 缩略图与媒体参数统一复用 `/api/upload`。

### 服务端依赖

- `GET/POST/DELETE /api/tools/presets`：preset CRUD。
- `POST /api/upload`：媒体输入上传（如工具需要）。

## 状态 / 数据流

- 工具选择与参数状态由 ToolsView/ParameterPanel 在前端本地维护。
- preset 通过 `/api/tools/presets` 持久化，服务端遵循 `route -> service -> repository` 分层。
- 缩略图/媒体 URL 在服务端做归一化处理后返回前端展示（以现有 service 为准）。

## 关键规则

- 工具注册表应作为“声明式配置层”，避免把复杂业务逻辑塞进注册表本体。
- preset 的存储格式与参数 schema 强绑定，调整 schema 时需同步评估旧 preset 兼容策略。

## 边界 / 非职责范围

- Tools 不负责 Playground 的生成编排与 history/gallery 沉淀。
- Tools 不负责把导出产物自动入库（除非新增明确需求并补齐存储链路与文档）。

## 修改影响范围

- 修改 tool-configs 或参数 schema 会影响已有 preset 的兼容性与 UI 渲染。
- 修改渲染 adapter 会影响性能、导出一致性与不同设备兼容性。
- 修改 preset API 会影响所有工具的保存/加载链路。

## 更新记录

- 2026-04-08：补充 Tools 模块文档，梳理路由入口、渲染/参数/preset 链路与边界。
- 2026-04-08：补充 4K 导出约束、preset 持久化字段规则与媒体参数上传要求。
- 2026-04-08：新增 Glass Logo Panorama 工具，并扩展参数面板以支持带 `accept` 限制的媒体输入和文本参数。
- 2026-04-08：补充 Tools 可使用 DOM/SVG 合成型渲染实现，以覆盖部分浏览器/环境下不稳定的 WebGL 场景。
