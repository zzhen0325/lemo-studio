import { MODEL_ID_WORKFLOW, WORKFLOW_BASE_MODELS } from '../constants/models';

/**
 * 判断一个模型 ID 或配置是否属于 Workflow 类型
 * 支持直接匹配 'Workflow'、匹配预设的基座模型列表、以及通过文件后缀判定
 */
export function isWorkflowModel(modelId?: string): boolean {
    if (!modelId) return false;

    return (
        modelId === MODEL_ID_WORKFLOW ||
        WORKFLOW_BASE_MODELS.includes(modelId) ||
        modelId.endsWith('.safetensors') ||
        modelId.includes('safetensors')
    );
}
