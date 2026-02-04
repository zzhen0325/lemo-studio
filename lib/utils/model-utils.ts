import { MODEL_ID_WORKFLOW } from '../constants/models';

/**
 * 判断一个模型 ID 或配置是否属于 Workflow 类型
 * 优先根据是否选择了 ComfyUI 工作流配置来判断
 */
export function isWorkflowModel(modelId?: string, hasWorkflowConfig?: boolean): boolean {
    if (hasWorkflowConfig) return true;
    if (!modelId) return false;

    return (
        modelId === MODEL_ID_WORKFLOW ||
        modelId.startsWith('wf_')
    );
}
