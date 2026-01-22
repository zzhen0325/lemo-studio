# 修复手动粘贴/上传图片后旧缓存数据覆盖的问题

## 问题分析
用户反馈在手动粘贴上传图片时，虽然 UI 显示了新图片，但实际生成时却使用了之前的图片。经过代码分析，发现以下原因：
1. **状态残留**：当用户通过“重新生成”或“编辑”进入编辑模式后，`config` 中的 `isEdit` 被设为 `true` 且 `editConfig` 包含了旧图片的标注和路径信息。
2. **清理逻辑缺失**：在 `handleFilesUpload`（处理粘贴和上传的函数）中，添加新参考图时没有清理 `isEdit` 和 `editConfig` 状态。
3. **优先级问题**：生成逻辑会优先使用 `editConfig` 中的数据，如果该状态未清理，即便 `uploadedImages` 更新了，后端仍可能按旧的编辑配置执行。

## 解决方案
### 1. 增强上传清理逻辑
在 [playground.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/playground.tsx) 的 `handleFilesUpload` 函数中，当用户上传或粘贴新的参考图（`target === 'reference'`）时，显式重置编辑相关的状态。

### 2. 优化图片移除逻辑
在 [playground.tsx](file:///Users/bytedance/Desktop/seeseezz/gulux/pages/playground.tsx) 的 `removeImage` 函数中，如果当前处于编辑模式，移除图片时也应重置编辑状态，防止残留的 `editConfig` 干扰后续操作。

## 实施步骤
### 步骤 1：修改 `handleFilesUpload`
在 `handleFilesUpload` 开始处，添加对 `isEdit`、`editConfig` 和 `parentId` 的重置逻辑。

### 步骤 2：修改 `removeImage`
在 `removeImage` 中，无论图片列表是否为空，只要发生了移除操作且处于编辑模式，就重置编辑状态。

## 验证方法
1. **场景测试**：
   - 先对一张图片进行“编辑”或点击历史记录中的“编辑”按钮。
   - 关闭编辑器，此时 `isEdit` 可能仍为 `true`（取决于关闭路径）。
   - 粘贴一张新图片。
   - 点击“生成”，验证生成的图片是基于新粘贴的图片而非旧图片的编辑版本。
2. **状态检查**：观察 `config` 对象，确保粘贴后 `isEdit` 变为 `false` 且 `editConfig` 为 `undefined`。
