## 需求结论
- 保留 loras、sourceImageUrls、localSourceIds 作为主字段。
- 将 workflowName 的展示职责并入 presetName（最终 UI/历史展示仅依赖 presetName）。
- loras 保留为结构化数据，presetName 仅作可读性标签（包含 workflowName + loras 摘要）。
- 增加 baseModel 字段以解耦“基础模型ID”和“工作流模式标识”。

## 伪代码
- 在类型层新增 baseModel?: string，标记真实基础模型ID
- 生成时：
  - baseModel = 真实基础模型ID
  - model = 现有工作流分支所需的模式标识（保持兼容）
  - presetName = buildPresetName(selectedPresetName, workflowName, loras)
- 展示时：
  - 仅使用 presetName 展示标签
- 回填时：
  - workflow 选择优先用 presetName 或 baseModel 判断
- 同步/持久化：
  - 历史与DB/文件路由都写入/回读 baseModel

## 影响范围
- 更新 GenerationConfig 类型与关联结构（Generation/History/后端模型）。
- 前端生成服务：构造 presetName（含 workflowName + loras 摘要）、写入 baseModel。
- 历史列表展示与回填：去掉对 workflowName 的依赖，使用 presetName/baseModel。
- 后端 history service 与文件路由：读写 baseModel，减少字段漂移。

## 验证方式
- 生成一条工作流记录与一条普通模型记录，确认
  - 历史标签显示为 presetName（含 workflowName/loras 摘要）
  - 回填时工作流/模型选择正确
  - sourceImageUrls/localSourceIds 保持同步可用
  - baseModel 正常存取

如果确认该计划，我将按此实现并进行验证。