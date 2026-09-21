"use client";

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@/hooks/common/use-toast';
import type { Generation } from '@/types/database';
import type { GenerationConfig } from '@/lib/playground/types';
import type { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { MODEL_ID_WORKFLOW } from '@/lib/constants/models';
import { downloadImage } from '@/lib/utils/download';
import { downloadGeneration } from '@/lib/interaction-tracking';
import { normalizeHistoryConfigForGeneration } from '../../../_lib/history-tags';
import { withoutPromptOptimizationSource } from '../../../_lib/prompt-history';
import type { ActiveShortcutTemplate } from '../shortcut-optimization';
import type { GenerateOptions } from '../../hooks/useGenerationService';

interface UsePlaygroundHistoryActionsArgs {
  workflows: IViewComfy[];
  defaultImageModelId: string;
  setActiveShortcutTemplate: Dispatch<SetStateAction<ActiveShortcutTemplate | null>>;
  handleGenerate: (options?: GenerateOptions) => Promise<void>;
  mutateHistory: () => Promise<unknown>;
}

export function usePlaygroundHistoryActions({
  workflows, defaultImageModelId, setActiveShortcutTemplate, handleGenerate, mutateHistory,
}: UsePlaygroundHistoryActionsArgs) {
  const { toast } = useToast();
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const setSelectedModel = usePlaygroundStore(s => s.setSelectedModel);
  const setSelectedPresetName = usePlaygroundStore(s => s.setSelectedPresetName);
  const setSelectedWorkflowConfig = usePlaygroundStore(s => s.setSelectedWorkflowConfig);
  const updateConfig = usePlaygroundStore(s => s.updateConfig);

  const getRecordSourceImageUrls = useCallback((recordConfig?: Partial<GenerationConfig>) => (
    recordConfig?.sourceImageUrls
      || (recordConfig?.editConfig?.referenceImages?.map((image) => image.dataUrl) || [])
  ), []);

  const findWorkflowForRecord = useCallback((recordConfig?: Partial<GenerationConfig>) => {
    const workflowName = recordConfig?.workflowName || recordConfig?.presetName;
    if (!workflowName) {
      return undefined;
    }

    return workflows.find((workflow) => (
      workflow.viewComfyJSON.title === workflowName
      || workflow.viewComfyJSON.id === workflowName
    ));
  }, [workflows]);

  const buildReplayConfigFromRecord = useCallback((result: Generation) => {
    const originalRecordConfig = { ...(result.config || {}) };
    delete originalRecordConfig.taskId;

    const currentStoreConfig = { ...usePlaygroundStore.getState().config };
    delete currentStoreConfig.taskId;

    const sourceImageUrls = getRecordSourceImageUrls(originalRecordConfig);
    const localSourceIds = originalRecordConfig.localSourceIds || [];
    const normalizedConfig = normalizeHistoryConfigForGeneration({
      ...currentStoreConfig,
      ...originalRecordConfig,
      prompt: originalRecordConfig.prompt || '',
      width: originalRecordConfig.width || 1024,
      height: originalRecordConfig.height || 1024,
      model: originalRecordConfig.model || currentStoreConfig.model,
      baseModel: originalRecordConfig.baseModel || currentStoreConfig.baseModel,
      loras: originalRecordConfig.loras || [],
      sourceImageUrls,
      localSourceIds,
      taskId: undefined,
    } as GenerationConfig);

    return {
      fullConfig: normalizedConfig,
      sourceImageUrls,
      localSourceIds,
    };
  }, [getRecordSourceImageUrls]);

  const applyHistoryRecordContext = useCallback(async (
    result: Generation,
    mode: 'full' | 'model' = 'full',
  ) => {
    const { fullConfig, sourceImageUrls, localSourceIds } = buildReplayConfigFromRecord(result);
    const currentStoreConfig = usePlaygroundStore.getState().config;
    const nextPrompt = mode === 'full' ? (fullConfig.prompt || '') : (currentStoreConfig.prompt || '');
    const effectiveModel = String(fullConfig.baseModel || fullConfig.model || defaultImageModelId);
    const matchedWorkflow = findWorkflowForRecord(result.config);
    const appliedPresetName = fullConfig.presetName || (matchedWorkflow ? matchedWorkflow.viewComfyJSON.title : undefined);

    setActiveShortcutTemplate(null);

    if (matchedWorkflow) {
      const appliedConfig = withoutPromptOptimizationSource({
        ...currentStoreConfig,
        ...fullConfig,
        prompt: nextPrompt,
        model: MODEL_ID_WORKFLOW,
        baseModel: effectiveModel,
        workflowName: matchedWorkflow.viewComfyJSON.title,
        loras: fullConfig.loras || [],
        isPreset: !!appliedPresetName,
        presetName: appliedPresetName,
        taskId: undefined,
      });
      setSelectedWorkflowConfig(matchedWorkflow, fullConfig.presetName || matchedWorkflow.viewComfyJSON.title);
      setSelectedModel(MODEL_ID_WORKFLOW);
      updateConfig(appliedConfig);
      setSelectedPresetName(appliedConfig.presetName);

      if (mode === 'full') {
        if (sourceImageUrls.length > 0) {
          await usePlaygroundStore.getState().applyImages(sourceImageUrls);
        } else {
          usePlaygroundStore.getState().setUploadedImages([]);
        }
      }

      return {
        fullConfig: appliedConfig,
        sourceImageUrls,
        localSourceIds,
      };
    } else {
      const appliedConfig = withoutPromptOptimizationSource({
        ...fullConfig,
        prompt: nextPrompt,
        model: effectiveModel,
        baseModel: effectiveModel,
        workflowName: undefined,
        loras: fullConfig.loras || [],
        isPreset: !!appliedPresetName,
        presetName: appliedPresetName,
        taskId: undefined,
      });
      setSelectedWorkflowConfig(undefined);
      applyModel(effectiveModel, appliedConfig);
      setSelectedPresetName(appliedConfig.presetName);

      if (mode === 'full') {
        if (sourceImageUrls.length > 0) {
          await usePlaygroundStore.getState().applyImages(sourceImageUrls);
        } else {
          usePlaygroundStore.getState().setUploadedImages([]);
        }
      }

      return {
        fullConfig: appliedConfig,
        sourceImageUrls,
        localSourceIds,
      };
    }
  }, [
    applyModel,
    buildReplayConfigFromRecord,
    defaultImageModelId,
    findWorkflowForRecord,
    setSelectedModel,
    setSelectedPresetName,
    setSelectedWorkflowConfig,
    setActiveShortcutTemplate,
    updateConfig,
  ]);

  const handleBatchUse = useCallback(async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });

    // Generate ALL 仅复用每张卡片的 prompt，始终使用当前模型配置进行文生图。
    for (const result of results) {
      const currentStoreConfig = usePlaygroundStore.getState().config;
      const prompt = result.config?.prompt || '';

      const fullConfig: GenerationConfig = {
        ...currentStoreConfig,
        prompt,
        taskId: undefined,
        isEdit: false,
        editConfig: undefined,
        parentId: undefined,
        sourceImageUrls: [],
        localSourceIds: [],
      };

      await handleGenerate({
        configOverride: fullConfig,
        sourceImageUrls: [],
        localSourceIds: [],
        ignoreActiveShortcutTemplate: true,
      });
      await new Promise(r => setTimeout(r, 300));
    }
  }, [handleGenerate, toast]);


  const handleRegenerate = async (result: Generation) => {
    const {
      fullConfig,
      sourceImageUrls,
      localSourceIds,
    } = await applyHistoryRecordContext(result, 'full');

    await handleGenerate({
      configOverride: fullConfig,
      sourceImageUrls,
      localSourceIds
    });
  };

  const handleDownload = (result: Generation, imageUrl: string) => {
    downloadImage(imageUrl, `PlaygroundV2-${Date.now()}.png`);

    if (result.id) {
      void (async () => {
        const trackResult = await downloadGeneration(result.id);
        if (!trackResult.success) {
          return;
        }
        await mutateHistory();
      })();
    }
  };

  const handleUseHistoryAll = useCallback(async (result: Generation) => {
    await applyHistoryRecordContext(result, 'full');
    toast({
      title: "参数已回填",
      description: "已恢复此条记录的完整生成上下文。",
    });
  }, [applyHistoryRecordContext, toast]);

  const handleUseHistoryModel = useCallback(async (result: Generation) => {
    await applyHistoryRecordContext(result, 'model');
    toast({
      title: "模型参数已回填",
      description: "已恢复模型、尺寸与相关参数，当前输入内容保持不变。",
    });
  }, [applyHistoryRecordContext, toast]);

  return { handleBatchUse, handleRegenerate, handleDownload, handleUseHistoryAll, handleUseHistoryModel };
}
