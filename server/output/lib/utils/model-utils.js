"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWorkflowModel = isWorkflowModel;
const models_1 = require("../constants/models");
/**
 * 判断一个模型 ID 或配置是否属于 Workflow 类型
 * 支持直接匹配 'Workflow'、匹配预设的基座模型列表、以及通过文件后缀判定
 */
function isWorkflowModel(modelId) {
    if (!modelId)
        return false;
    return (modelId === models_1.MODEL_ID_WORKFLOW ||
        models_1.WORKFLOW_BASE_MODELS.includes(modelId) ||
        modelId.endsWith('.safetensors') ||
        modelId.includes('safetensors'));
}
