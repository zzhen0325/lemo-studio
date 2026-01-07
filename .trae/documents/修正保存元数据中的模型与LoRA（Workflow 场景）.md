## 问题定位
- Workflow 的参数映射来源于页面映射器（mapping-editor-page.tsx 及其子组件）。现有映射只覆盖旧版字段（prompt/width/height），未输出统一模型字段（model）与 LoRA（lora）。
- 生成服务在 Workflow 分支按映射读取参数时，因缺少 model/lora 映射，导致保存的元数据出现 "model": "Workflow"、"lora": ""。

## 目标
- 将 Workflow 参数映射统一到新数据模型：prompt/width/height/batch_size/model/lora。
- 保证映射器保存的 mappingConfig.components 包含 paramName 与 workflowPath，可被生成服务准确解析。

## 具体改动
1) 扩展映射项定义
- 在映射组件创建/编辑时（ParameterMappingPanel），支持选择标准化 paramName：
  - prompt / width / height / batch_size / model / lora
- 对应的 workflowPath 由用户在 WorkflowAnalyzer 中点选节点与参数生成，保持现有交互。

2) 保存映射配置
- mapping-editor-page.tsx 的 handleSaveConfig 已将 uiConfig.components 持久化；确保新增的 model/lora 映射项同样写入。
- 选择已有工作流时（handleSelectWorkflow），保留/加载已有 components，兼容旧版本；用户可补充 model/lora 映射。

3) 生成服务读取映射
- 在 useGenerationService.ts 的 Workflow 分支中：
  - 读取 mappingConfig.components，优先按 paramName 匹配：
    - model：从匹配的 workflowPath 获取实际值（如 flux1-dev-fp8.safetensors）并写入 metadata.config.model
    - lora：从匹配的 workflowPath 或从 selectedLoras 组合写入 metadata.config.lora
  - 仍保留旧逻辑（title 检索）作为回退，避免现有映射缺失导致空写。

4) 兼容旧映射
- 若旧工作流没有新增映射项：
  - model：从 workflowApiJSON 常见节点参数（如 'ckpt_name'、'model'、'checkpoint'）尝试解析
  - lora：从 selectedLoras 读取当前 UI 选择，格式化为 'name@strength' 列表

## 验证
- 在映射编辑器中为 ComfyUI 的模型节点（如 CheckpointLoader）创建一个组件，paramName 选 'model'，workflowPath 指向模型文件参数；为 LoRA 节点创建 'lora' 映射或依赖 UI 选择。
- 回到生成：执行 Workflow，一张图片生成后检查 outputs/*.json：
  - metadata.config.model 为 flux1-dev-fp8.safetensors（或实际模型）
  - metadata.config.lora 为正确的 LoRA 列表
- 历史列表读取正常显示，聚合不受影响。

## 风险与回退
- 若工作流结构差异较大，可能无法自动定位模型参数；提供回退检测与提示。
- 所有改动限定在映射器与读取层，不影响现有生成流程与 UI。

确认后，我将：
- 扩展映射面板支持 model/lora 的标准 paramName；
- 在生成服务中新增解析函数，接入新增映射与回退逻辑；
- 验证生成的元数据与历史展示一致。