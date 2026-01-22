"use client";

import { useCallback, useState } from "react";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { projectStore } from "@/lib/store/project-store";
import { userStore } from "@/lib/store/user-store";
import { useAIService } from "@/hooks/ai/useAIService";
import { useToast } from "@/hooks/common/use-toast";
import { GenerationConfig, EditPresetConfig } from "@/components/features/playground-v2/types";
import { Generation, SelectedLora } from "@/types/database";
import { IMultiValueInput } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { usePostPlayground } from "@/hooks/features/playground/use-post-playground";
import { toUnifiedConfigFromLegacy } from "@/lib/adapters/data-mapping";
import { getApiBase } from "@/lib/api-base";

export interface UnifiedModelConfig {
    id: string;
    displayName: string;
}

export const AVAILABLE_MODELS: UnifiedModelConfig[] = [

    { id: 'gemini-3-pro-image-preview', displayName: 'Nano banana' },
    { id: 'coze_seed4', displayName: 'Seedream 4' },
    // { id: 'seed4_lemo1230', displayName: 'Seed 4.0' },
    { id: 'seed4_2_lemo', displayName: 'Seed4 ' },
    { id: 'lemo_2dillustator', displayName: 'Seed3 Lemo' },
    // { id: 'lemoseedt2i', displayName: 'Seed 4' },

];

export interface GenerateOptions {
    configOverride?: GenerationConfig;
    fixedCreatedAt?: string;
    isBackground?: boolean;
    editConfig?: EditPresetConfig;
    isEdit?: boolean;
    parentId?: string;
    taskId?: string;
    useCurrentBatchSize?: boolean;
    sourceImageUrls?: string[];
    localSourceIds?: string[];
}

export function useGenerationService() {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    const selectedModel = usePlaygroundStore(s => s.selectedModel);
    const selectedWorkflowConfig = usePlaygroundStore(s => s.selectedWorkflowConfig);
    const isMockMode = usePlaygroundStore(s => s.isMockMode);
    const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
    const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);

    const { callImage, isLoading: isAIProcessing } = useAIService();
    const { doPost: runComfyWorkflow, loading: isWorkflowProcessing } = usePostPlayground();

    // Helper: URL to DataURL
    const blobToDataURL = (blob: Blob) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });

    // Helper: Save to outputs
    const saveImageToOutputs = async (dataUrl: string, metadata?: Record<string, unknown>) => {
        const resp = await fetch(`${getApiBase()}/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: dataUrl, ext: 'png', subdir: 'outputs', metadata })
        });
        const json = await resp.json();
        return resp.ok && json?.path ? String(json.path) : dataUrl;
    };

    // Helper: Save to history.json
    const saveHistoryToBackend = async (item: Generation) => {
        try {
            await fetch(`${getApiBase()}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
        } catch (err) {
            console.error('Failed to save history:', err);
            toast({ title: "保存历史失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
        }
    };

    const updateHistoryAndSave = useCallback((uniqueId: string, result: Generation) => {
        setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === uniqueId ? {
            ...item,
            ...result,
            // 确保保持原始 ID 和基础字段
            id: uniqueId,
            userId: item.userId,
            projectId: item.projectId,
            createdAt: item.createdAt,
        } : item));
        saveHistoryToBackend(result);

        // 如果成功生成，清除正在生成的标志
        if (result.status === 'completed') {
            setIsGenerating(false);
        }
    }, [setGenerationHistory, saveHistoryToBackend]);

    const handleUnifiedImageGen = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        // Calculate effective source URLs - prioritize passed parameter
        // 如果传入了 sourceImageUrls，则严格使用它，否则才回退到 Store 状态
        // 关键：在批量生成或重新生成时，sourceImageUrls 不为空，不应受 Store 状态影响
        const effectiveSourceUrls = sourceImageUrls.length > 0 
            ? sourceImageUrls 
            : usePlaygroundStore.getState().uploadedImages.map(img => img.path || img.previewUrl);
        
        // 同样逻辑应用于 Local IDs
        const effectiveLocalId = localSourceId || (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages[0]?.id : undefined);
        const effectiveLocalIds = localSourceIds.length > 0 
            ? localSourceIds 
            : (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages.map(img => img.id).filter((id): id is string => !!id) : []);

        const effectiveSourceUrl = effectiveSourceUrls[0];
        const unified = toUnifiedConfigFromLegacy(currentConfig);

        // 使用统一模型配置进行映射，优先使用 config 中的模型 ID
        // 如果 config 中没有模型 ID，则使用全局选中的模型 ID
        const modelId = unified.model || selectedModel || "gemini-3-pro-image-preview";

        console.log(`[useGenerationService] selectedModel: ${selectedModel}, configModel: ${currentConfig.model}, unifiedModel: ${unified.model}, final mapping to modelId: ${modelId}`);

        // Validation for Seed 4.2 dimensions
        if (modelId === "seed4_2_lemo") {
            if (Number(unified.width) < 1024 || Number(unified.height) < 1024) {
                toast({
                    title: "尺寸限制",
                    description: "Seed 4.2 模型的宽高尺寸不能小于 1024px",
                    variant: "destructive"
                });
                throw new Error("Seed 4.2 dimension validation failed");
            }
        }

        const isCoze = modelId === "coze_seed4";
        const processedImages = new Set<string>();
        let lastSavedPath = "";

        // 为历史记录构造成组的参考图信息 (editConfig)
        // 如果当前没有从编辑器传来的 editConfig，则根据上传列表自动生成一个

        const effectiveEditConfig: EditPresetConfig | undefined = currentConfig.editConfig || (effectiveSourceUrls.length > 0 ? {
            canvasJson: {},
            referenceImages: effectiveSourceUrls.map((url, idx) => ({
                id: `ref-${idx}`,
                dataUrl: url,
                label: `Image ${idx + 1}`
            })),
            originalImageUrl: effectiveSourceUrl || '',
            annotations: [],
            backgroundColor: 'transparent',
            canvasSize: { width: Number(unified.width), height: Number(unified.height) }
        } : undefined);

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            aspectRatio: unified.aspectRatio === 'auto' ? undefined : unified.aspectRatio,
            imageSize: unified.imageSize,
            batchSize: 1, // Single task per call now
            image: effectiveSourceUrl,
            // 传递所有收集到的图片作为参考图
            images: effectiveSourceUrls.length > 0 ? effectiveSourceUrls : undefined,
            options: {
                seed: Math.floor(Math.random() * 2147483647),
                stream: isCoze
            }
        }, isCoze ? async (chunk) => {
            console.log(`[useGenerationService] Received stream chunk:`, chunk);
            if (chunk.text) {
                setGenerationHistory((prev: Generation[]) => prev.map(item =>
                    item.id === uniqueId
                        ? { ...item, llmResponse: (item.llmResponse || "") + chunk.text }
                        : item
                ));
            }
            if (chunk.images && chunk.images.length > 0) {
                const savePromises = chunk.images
                    .filter(imgUrl => !processedImages.has(imgUrl))
                    .map(async (imgUrl) => {
                        processedImages.add(imgUrl);
                        try {
                            console.log(`[useGenerationService] Saving streamed image: ${imgUrl}`);
                            const savedPath = await saveImageToOutputs(
                                imgUrl,
                                {
                                    config: {
                                        ...unified,
                                        model: modelId,
                                        baseModel: modelId,
                                        localSourceId: effectiveLocalId,
                                        localSourceIds: effectiveLocalIds,
                                        presetName: currentConfig.presetName,
                                    },
                                    createdAt: generationTime,
                                    sourceImageUrl: effectiveSourceUrl,
                                    sourceImageUrls: effectiveSourceUrls,
                                    localSourceId: effectiveLocalId,
                                    localSourceIds: effectiveLocalIds,
                                    baseModel: modelId,
                                }
                            );
                            lastSavedPath = savedPath;
                            console.log(`[useGenerationService] Streamed image saved to: ${savedPath}`);
                            setGenerationHistory((prev: Generation[]) => prev.map(item =>
                                item.id === uniqueId
                                    ? { ...item, outputUrl: savedPath, status: 'completed', editConfig: effectiveEditConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId, sourceImageUrls: effectiveSourceUrls }
                                    : item
                            ));
                        } catch (err) {
                            console.error("Failed to save streamed image:", err);
                        }
                    });
                await Promise.all(savePromises);
            }
        } : undefined);

        console.log(`[useGenerationService] callImage finished. isCoze: ${isCoze}`);

        if (isCoze) {
            console.log(`[useGenerationService] Coze stream call finished. lastSavedPath: ${lastSavedPath}`);
            // Wait for a small delay to ensure all state updates and async tasks are settled
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalItemInState = usePlaygroundStore.getState().generationHistory.find(h => h.id === uniqueId);

            if (finalItemInState) {
                const finalOutputUrl = lastSavedPath || finalItemInState.outputUrl;
                if (!finalOutputUrl) {
                    console.warn(`[useGenerationService] Coze finished but no image URL was captured!`);
                }

                const itemToSave = {
                    ...finalItemInState,
                    config: {
                        ...finalItemInState.config,
                        loras: undefined,
                        workflowName: undefined
                    },
                    outputUrl: finalOutputUrl,
                    status: finalOutputUrl ? 'completed' : finalItemInState.status
                } as Generation;

                console.log(`[useGenerationService] Finalizing Coze history with outputUrl: ${itemToSave.outputUrl}`);
                updateHistoryAndSave(uniqueId, itemToSave);
            }
        } else if (res?.images && res.images.length > 0) {
            const dataUrl = res.images[0];
            const savedPath = await saveImageToOutputs(
                dataUrl,
                {
                    config: {
                        ...unified,
                        model: modelId,
                        baseModel: modelId,
                        lora: unified.lora,
                        localSourceId: effectiveLocalId,
                        localSourceIds: effectiveLocalIds,
                        presetName: currentConfig.presetName,
                    },
                    createdAt: generationTime,
                    sourceImageUrl: effectiveSourceUrl,
                    sourceImageUrls: effectiveSourceUrls,
                    localSourceId: effectiveLocalId,
                    localSourceIds: effectiveLocalIds,
                    baseModel: modelId,
                }
            );
            const gen: Generation = {
                id: uniqueId,
                userId: userStore.currentUser?.id || 'anonymous',
                projectId: projectStore.currentProjectId || 'default',
                outputUrl: savedPath,
                config: {
                    ...unified,
                    model: modelId,
                    baseModel: modelId,
                    loras: undefined,
                    workflowName: undefined,
                    presetName: currentConfig.presetName,
                },
                status: 'completed',
                sourceImageUrl: effectiveSourceUrl,
                sourceImageUrls: effectiveSourceUrls,
                localSourceId: effectiveLocalId,
                localSourceIds: effectiveLocalIds,
                baseModel: modelId,
                createdAt: generationTime,
                editConfig: effectiveEditConfig,
                isEdit: currentConfig.isEdit,
                parentId: currentConfig.parentId,
                taskId: currentConfig.taskId || taskId,
            };
            updateHistoryAndSave(uniqueId, gen);
        } else {
            throw new Error(`${selectedModel} returned empty result`);
        }
    }, [selectedModel, setGenerationHistory, updateHistoryAndSave, callImage, toast]);

    const handleWorkflow = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        if (!selectedWorkflowConfig) throw new Error("未选择工作流");

        // Calculate effective source URL - prioritize passed parameter
        const effectiveSourceUrls = sourceImageUrls.length > 0
            ? sourceImageUrls
            : usePlaygroundStore.getState().uploadedImages.map(img => img.path || img.previewUrl);
            
        // 同样逻辑应用于 Local IDs
        const effectiveLocalId = localSourceId || (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages[0]?.id : undefined);
        const effectiveLocalIds = localSourceIds.length > 0 
            ? localSourceIds 
            : (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages.map(img => img.id).filter((id): id is string => !!id) : []);

        const effectiveSourceUrl = effectiveSourceUrls[0];
        const flattenInputs = (arr: IMultiValueInput[]) => arr.flatMap(g => g.inputs.map(i => ({ key: i.key, value: i.value, valueType: i.valueType, title: i.title })));
        const allInputs = [...flattenInputs(selectedWorkflowConfig.viewComfyJSON.inputs), ...flattenInputs(selectedWorkflowConfig.viewComfyJSON.advancedInputs)];
        const mappingConfig = selectedWorkflowConfig.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;

        let mappedInputs: { key: string; value: unknown }[] = [];
        if (mappingConfig?.components?.length) {
            const paramMap = new Map<string, unknown>();
            mappingConfig.components.forEach(comp => {
                if (!comp.properties?.paramName || !comp.mapping?.workflowPath) return;
                const pathKey = comp.mapping.workflowPath.join("-");
                const pName = comp.properties.paramName;
                if (pName === 'prompt' && currentConfig.prompt) paramMap.set(pathKey, currentConfig.prompt);
                else if (pName === 'width') paramMap.set(pathKey, currentConfig.width);
                else if (pName === 'height') paramMap.set(pathKey, currentConfig.height);
            });
            mappedInputs = allInputs.map(item => ({ key: item.key, value: paramMap.has(item.key) ? paramMap.get(item.key) : item.value }));
        } else {
            mappedInputs = allInputs.map(item => {
                const title = item.title || "";
                if (/prompt|文本|提示/i.test(title)) return { key: item.key, value: currentConfig.prompt };
                if (/width/i.test(title)) return { key: item.key, value: currentConfig.width };
                if (/height/i.test(title)) return { key: item.key, value: currentConfig.height };
                return { key: item.key, value: item.value };
            });
        }

        // Fix: Use runComfyWorkflow correctly with its expected signature
        await new Promise<void>((resolve, reject) => {
            runComfyWorkflow({
                viewComfy: {
                    inputs: mappedInputs as { key: string; value: string | number | boolean | File; }[],
                    textOutputEnabled: selectedWorkflowConfig.viewComfyJSON.textOutputEnabled ?? false
                },
                workflow: selectedWorkflowConfig.workflowApiJSON,
                viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint,
                onSuccess: async (blobs) => {
                    try {
                        if (blobs && blobs.length > 0) {
                            const dataUrl = await blobToDataURL(blobs[0]);
                            const savedPath = await saveImageToOutputs(
                                dataUrl,
                                {
                                    config: {
                                        ...currentConfig,
                                        model: "Workflow",
                                        baseModel: "Workflow",
                                        workflowName: selectedWorkflowConfig.viewComfyJSON.title,
                                        loras: usePlaygroundStore.getState().selectedLoras,
                                        localSourceId: effectiveLocalId,
                                        localSourceIds: effectiveLocalIds,
                                        presetName: currentConfig.presetName,
                                    },
                                    createdAt: generationTime,
                                    sourceImageUrl: effectiveSourceUrl,
                                    sourceImageUrls: effectiveSourceUrls,
                                    localSourceId: effectiveLocalId,
                                    localSourceIds: effectiveLocalIds,
                                    baseModel: "Workflow",
                                }
                            );

                            const gen: Generation = {
                                id: uniqueId,
                                userId: userStore.currentUser?.id || 'anonymous',
                                projectId: projectStore.currentProjectId || 'default',
                                outputUrl: savedPath,
                                config: {
                                    ...toUnifiedConfigFromLegacy(currentConfig),
                                    model: "Workflow",
                                    baseModel: "Workflow",
                                    workflowName: selectedWorkflowConfig.viewComfyJSON.title,
                                    loras: usePlaygroundStore.getState().selectedLoras,
                                    presetName: currentConfig.presetName,
                                },
                                status: 'completed',
                                sourceImageUrl: effectiveSourceUrl,
                                sourceImageUrls: effectiveSourceUrls,
                                localSourceId: effectiveLocalId,
                                localSourceIds: effectiveLocalIds,
                                baseModel: "Workflow",
                                createdAt: generationTime,
                                editConfig: currentConfig.editConfig,
                                isEdit: currentConfig.isEdit,
                                parentId: currentConfig.parentId,
                                taskId: currentConfig.taskId || taskId,
                            };
                            updateHistoryAndSave(uniqueId, gen);
                            resolve();
                        } else {
                            reject(new Error("工作流未返回图片结果"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                },
                onError: (err) => {
                    reject(err);
                }
            });
        });
    }, [selectedWorkflowConfig, userStore.currentUser?.id, projectStore.currentProjectId, updateHistoryAndSave, runComfyWorkflow, blobToDataURL]);

    const executeGeneration = useCallback(async (uniqueId: string, taskId: string, finalConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        const unifiedCfg = toUnifiedConfigFromLegacy(finalConfig);
        
        // 优先使用 config 中的模型 ID
        const effectiveModel = unifiedCfg.model || selectedModel;
        const isWorkflowModel = effectiveModel === "Workflow" ||
            effectiveModel?.endsWith('.safetensors') ||
            effectiveModel?.includes('safetensors');

        try {
            if (isMockMode) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                const result: Generation = {
                    id: uniqueId,
                    userId: userStore.currentUser?.id || 'anonymous',
                    projectId: projectStore.currentProjectId || 'default',
                    outputUrl: mockImageUrl,
                    config: {
                        prompt: unifiedCfg.prompt,
                        width: unifiedCfg.width,
                        height: unifiedCfg.height,
                        model: unifiedCfg.model,
                        lora: unifiedCfg.lora,
                        loras: isWorkflowModel ? usePlaygroundStore.getState().selectedLoras : undefined,
                        workflowName: isWorkflowModel ? usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined : undefined,
                        localSourceId: localSourceId,
                        localSourceIds: localSourceIds,
                    },
                    status: 'completed',
                    sourceImageUrl: sourceImageUrls[0],
                    sourceImageUrls: sourceImageUrls,
                    localSourceId: localSourceId,
                    localSourceIds: localSourceIds,
                    createdAt: new Date().toISOString(),
                    taskId: taskId,
                };
                updateHistoryAndSave(uniqueId, result);
                return;
            }

            if (isWorkflowModel) {
                await handleWorkflow(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
            } else {
                await handleUnifiedImageGen(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
            }
        } catch (err) {
            console.error("Generation failed:", err);
            // Cleanup on failure
            setGenerationHistory(prev => prev.filter(item => item.id !== uniqueId));
            toast({
                title: "生成失败",
                description: err instanceof Error ? err.message : "未知错误",
                variant: "destructive"
            });
        }
    }, [isMockMode, userStore.currentUser?.id, projectStore.currentProjectId, selectedModel, handleWorkflow, handleUnifiedImageGen, updateHistoryAndSave, setGenerationHistory, toast]);

    const handleGenerate = useCallback(async (options: GenerateOptions = {}) => {
        const { configOverride, fixedCreatedAt, isBackground } = options;
        const generationTime = fixedCreatedAt || new Date().toISOString();
        const freshConfig = usePlaygroundStore.getState().config;
        const currentLoras = usePlaygroundStore.getState().selectedLoras;

        console.log(`[useGenerationService] handleGenerate called, isBackground: ${isBackground}`);

        // 1. Get uploaded images first - prioritize options
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
        
        // 关键修复：如果 options 中没有提供 sourceImageUrls，则从 Store 中获取最新的图片数据
        // 这确保了手动粘贴或通过 handleFilesUpload 上传的图片能够被 handleGenerate 正确读取
        const sourceImageUrls = options.sourceImageUrls || currentUploadedImages.map(img => img.path || img.previewUrl);
        const localSourceIds = options.localSourceIds || currentUploadedImages.map(img => img.id).filter((id): id is string => !!id);
        const localSourceId = localSourceIds[0];

        // 2. Get original editConfig
        const editConfig = options.editConfig || configOverride?.editConfig || freshConfig.editConfig;

        // 3. Determine isEdit BEFORE auto-generating references config
        const isEdit = options.isEdit !== undefined ? options.isEdit : (configOverride?.isEdit || freshConfig.isEdit || false);

        const sourceImageUrl = sourceImageUrls[0];

        // 4. Create display/effective editConfig for history and generation
        const width = configOverride?.width || freshConfig.width;
        const height = configOverride?.height || freshConfig.height;

        // 所有的参考图都应该存储在 sourceImageUrls，editConfig.referenceImages 也直接读 sourceImageUrls
        // 如果 sourceImageUrls 为空，则 displayEditConfig 中的 referenceImages 必须为空
        const displayEditConfig = editConfig ? {
            ...editConfig,
            referenceImages: sourceImageUrls.map((url, idx) => ({
                id: editConfig.referenceImages?.[idx]?.id || `ref-${idx}`,
                dataUrl: url,
                label: editConfig.referenceImages?.[idx]?.label || `Image ${idx + 1}`
            })),
            originalImageUrl: sourceImageUrl || editConfig.originalImageUrl || '',
        } : (sourceImageUrls.length > 0 ? {
            canvasJson: {},
            referenceImages: sourceImageUrls.map((url, idx) => ({
                id: `ref-${idx}`,
                dataUrl: url,
                label: `Image ${idx + 1}`
            })),
            originalImageUrl: sourceImageUrl || '',
            annotations: [],
            backgroundColor: 'transparent',
            canvasSize: { width: Number(width), height: Number(height) }
        } : undefined);

        const parentId = options.parentId || configOverride?.parentId || freshConfig.parentId;
        const taskId = options.taskId || configOverride?.taskId || freshConfig.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));

        const combinedConfig = {
            ...freshConfig,
            ...(configOverride && typeof configOverride === 'object' ? configOverride : {}),
        };

        const unifiedCfg = toUnifiedConfigFromLegacy(combinedConfig);
        
        // Determine effective model and workflow status
        const effectiveModel = unifiedCfg.model || usePlaygroundStore.getState().selectedModel;
        const isWorkflowModel = effectiveModel === "Workflow" ||
            effectiveModel?.endsWith('.safetensors') ||
            effectiveModel?.includes('safetensors');

        // 优先使用 config 中的 presetName，如果是工作流则回退到 workflowName
        const finalPresetName = combinedConfig.presetName || (isWorkflowModel ? (combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title) : undefined);

        const finalConfig: GenerationConfig = {
            ...combinedConfig,
            loras: currentLoras,
            presetName: finalPresetName,
            baseModel: effectiveModel, // Store the real model ID
            workflowName: isWorkflowModel ? (combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title) : undefined,
            editConfig: displayEditConfig,
            isEdit,
            parentId,
        };

        // Set state to indicate generation has started
        setHasGenerated(true);

        const configForHistory = { ...finalConfig };
        if (!isWorkflowModel) {
            configForHistory.loras = undefined;
            configForHistory.workflowName = undefined;
        }

        const uniqueId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        const loadingGen: Generation = {
            id: uniqueId,
            userId: userStore.currentUser?.id || 'anonymous',
            projectId: projectStore.currentProjectId || 'default',
            outputUrl: "",
            config: {
                ...configForHistory,
                localSourceId,
                localSourceIds,
            },
            status: 'pending',
            sourceImageUrl: sourceImageUrl,
            sourceImageUrls: sourceImageUrls,
            localSourceId: localSourceId,
            localSourceIds: localSourceIds,
            baseModel: effectiveModel,
            editConfig: displayEditConfig,
            isEdit: isEdit,
            parentId: parentId,
            taskId: taskId,
            createdAt: generationTime,
        };

        console.log(`[useGenerationService] Adding loading item to history: ${uniqueId}, taskId: ${taskId}`);

        // Use standard state update for history
        setGenerationHistory((prev: Generation[]) => [loadingGen, ...prev]);

        if (isBackground) return uniqueId;

        return executeGeneration(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
    }, [setHasGenerated, userStore.currentUser?.id, projectStore.currentProjectId, setGenerationHistory, executeGeneration]);

    return {
        handleGenerate,
        executeGeneration,
        isGenerating: isGenerating || isAIProcessing || isWorkflowProcessing,
        isLoading: isAIProcessing || isWorkflowProcessing
    };
}
