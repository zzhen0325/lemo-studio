# Edit

## 背景

Edit 用于对已有图片进行“基于标注与 prompt 的再次生成”。它通过图片编辑弹窗完成区域/标注操作并生成最终 prompt，然后复用 Playground 的常规生成链路产出新结果，并沉淀到 history/gallery。

## 模块职责

- 提供图片编辑弹窗（上传/替换参考图、粘贴上传、标注、裁剪、画笔等交互）。
- 将编辑会话导出为可用于生成的输入（合成图 + final prompt + session snapshot）。
- 回填 Playground 的生成配置并触发生成，使编辑结果可追溯（parent 链）且可复用。

## 核心流程

### 入口

- 首页与 Dock 的 Edit 入口触发上传/选择图片后打开编辑弹窗。
- 从历史记录的 “Edit” 动作可回溯 parent 链并用历史图作为编辑输入。

### 编辑会话与确认

- 在弹窗内进行标注/裁剪/画笔等操作，生成 `mergedImageDataUrl`（带可视叠加的合成图）。
- 通过 prompt 构建器把用户输入与标注 token 合成 `finalPrompt`。
- 确认后输出 payload：合成图、finalPrompt、sessionSnapshot、模型与尺寸等参数。

### 回填与生成

- Playground 接收确认 payload 后：
  - 清空旧参考图并上传合成图为新的 reference。
  - 更新 config（prompt/model/isEdit/editConfig/parentId/imageEditorSession 等）。
  - 触发常规生成（`POST /api/ai/image`），并把结果写入 `/api/history`。

## 输入 / 输出

### 输入

- 参考图（历史图或用户上传图）。
- 编辑会话（标注/裁剪等操作产生的 session）。
- 文本输入（plain prompt）。

### 输出

- 合成后的输入图（用于再次生成）。
- final prompt（用于生成）。
- 新的生成结果与 history/gallery 记录。

## 依赖关系

### 前端依赖

- 图片编辑弹窗组件与编辑器 hook（Fabric/Canvas 相关实现）。
- Playground 容器与 `useGenerationService`：用于回填配置、上传合成图、触发生成、写入 history。

### 服务端依赖

- `POST /api/upload`：上传合成图。
- `POST /api/ai/image`：基于合成图与 prompt 生成新结果。
- `POST /api/history`：保存生成结果与配置。

## 状态 / 数据流

- Edit 的 open/session 状态由 Playground store 统一管理（作为 UI/editor 状态的一部分）。
- 生成与持久化复用 Playground 的标准数据流：生成 -> 保存 history -> Gallery/History 回看复用。

## 关键规则

- Edit 不引入独立“编辑专用生成 API”，而是把编辑结果转成“标准生成输入”复用统一生成链路（以现有实现为准）。
- parentId 与 imageEditorSession 用于追溯编辑来源与复现编辑上下文（变更时需同步考虑历史回溯与复用链路）。
- 弹窗内支持点击、拖拽和粘贴图片作为编辑底图；当已有编辑内容时，替换图片必须确认，因为会清空标注、画笔和裁剪。
- 图片缩放只允许发生在左侧网格画布容器内；右侧 Prompt Editor 不能被画布放大联动撑开。
- 画笔工具必须保留颜色与粗细控制，且笔画导出要继续写入 session snapshot。
- Playground 编辑确认后必须同时保留 `isEdit`、`parentId`、`imageEditorSession`、`editConfig.originalImageUrl`、`editConfig.imageEditorSession`，否则 History 的 `Edit Again` 和 Gallery 的 edit 分类会失真。

## 边界 / 非职责范围

- Edit 不负责后端模型能力选择与 provider 适配，仅作为输入加工与生成触发。
- Edit 不负责保存完整编辑资源资产库，结果沉淀以 history/gallery 为主。

## 修改影响范围

- 修改 prompt 构建逻辑会影响生成结果质量与可解释性。
- 修改 session 导出/回填字段会影响历史可追溯链路与“再次编辑”能力。
- 修改弹窗编辑器的渲染与导出策略会影响性能与输出一致性。

## 更新记录

- 2026-04-12：补充粘贴上传、局部缩放、画笔控制，以及 edit 记录在 History/Gallery 回填链路中的字段完整性要求。
- 2026-04-08：补充 Edit 模块文档，梳理入口、会话输出、回填与生成链路。
