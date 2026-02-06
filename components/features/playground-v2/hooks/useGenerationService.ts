"use client";

import { useCallback, useState } from "react";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { projectStore } from "@/lib/store/project-store";
import { userStore } from "@/lib/store/user-store";
import { useAIService } from "@/hooks/ai/useAIService";
import { useToast } from "@/hooks/common/use-toast";
import { GenerationConfig, EditPresetConfig } from "@/components/features/playground-v2/types";
import { Generation } from "@/types/database";
import { IMultiValueInput } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { usePostPlayground } from "@/hooks/features/playground/use-post-playground";
import { toUnifiedConfigFromLegacy } from "@/lib/adapters/data-mapping";
import { getApiBase } from "@/lib/api-base";
import { MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";

export interface UnifiedModelConfig {
    id: string;
    displayName: string;
}

export const AVAILABLE_MODELS: UnifiedModelConfig[] = [
    { id: 'gemini-3-pro-image-preview', displayName: 'Nano banana pro' },
    { id: 'gemini-2.5-flash-image', displayName: 'Nano banana' },

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
    const blobToDataURL = useCallback((blob: Blob) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    }), []);

    // Helper: Save to outputs
    const saveImageToOutputs = useCallback(async (dataUrl: string, metadata?: Record<string, unknown>) => {
        try {
            const resp = await fetch(`${getApiBase()}/save-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: dataUrl, subdir: 'outputs', metadata })
            });
            const json = await resp.json();
            if (!resp.ok || !json?.path) {
                console.error('[saveImageToOutputs] Failed:', { status: resp.status, json });
                throw new Error(json?.message || `HTTP ${resp.status}`);
            }
            return String(json.path);
        } catch (err) {
            console.error('[saveImageToOutputs] Error:', err);
            // CRITICAL: Return empty string instead of defaulting to dataUrl
            // to prevent leaking massive Base64 into the history store persistence
            toast({
                title: "图片保存失败",
                description: "生成结果无法保存到服务器。历史记录将由于空间限制无法保存此预览。",
                variant: "destructive"
            });
            return "";
        }
    }, [toast]);

    // Helper: Save to history.json

    const addGalleryItem = usePlaygroundStore(s => s.addGalleryItem);

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

        // 如果成功生成，同步到 Gallery 状态
        if (result.status === 'completed') {
            addGalleryItem({
                ...result,
                id: uniqueId,
                status: 'completed'
            });
        }

        // Internal helper to avoid re-render issues
        const saveToBackend = async (data: Generation) => {
            try {
                await fetch(`${getApiBase()}/history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
            } catch (err) {
                console.error('Failed to save history:', err);
                toast({ title: "保存历史失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
            }
        };
        saveToBackend(result);

        // 如果成功生成，清除正在生成的标志
        if (result.status === 'completed') {
            setIsGenerating(false);
        }
    }, [setGenerationHistory, toast, addGalleryItem]);

    const handleUnifiedImageGen = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        // Calculate effective source URLs - prioritize passed parameter
        const effectiveSourceUrls = sourceImageUrls.length > 0
            ? sourceImageUrls
            : usePlaygroundStore.getState().uploadedImages.map(img => img.path || img.previewUrl);

        const effectiveLocalId = localSourceId || (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages[0]?.id : undefined);
        const effectiveLocalIds = localSourceIds.length > 0
            ? localSourceIds
            : (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages.map(img => img.id).filter((id): id is string => !!id) : []);

        const effectiveSourceUrl = effectiveSourceUrls[0];
        const unified = toUnifiedConfigFromLegacy(currentConfig);
        const modelId = unified.model || selectedModel || "gemini-3-pro-image-preview";

        console.log(`[useGenerationService] selectedModel: ${selectedModel}, configModel: ${currentConfig.model}, unifiedModel: ${unified.model}, final mapping to modelId: ${modelId}`);

        if (modelId === "seed4_2_lemo") {
            if (Number(unified.width) < 1024 || Number(unified.height) < 1024) {
                toast({ title: "尺寸限制", description: "Seed 4.2 模型的宽高尺寸不能小于 1024px", variant: "destructive" });
                throw new Error("Seed 4.2 dimension validation failed");
            }
        }

        const isCoze = modelId === "coze_seed4";
        const processedImages = new Set<string>();
        let lastSavedPath = "";

        const effectiveEditConfig: EditPresetConfig | undefined = (currentConfig.isEdit || currentConfig.editConfig) ? (currentConfig.editConfig || (effectiveSourceUrls.length > 0 ? {
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
        } : undefined)) : undefined;

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            aspectRatio: unified.aspectRatio === 'auto' ? undefined : unified.aspectRatio,
            imageSize: modelId === 'gemini-3-pro-image-preview' ? unified.imageSize : undefined,
            batchSize: 1,
            image: effectiveSourceUrl,
            images: effectiveSourceUrls.length > 0 ? effectiveSourceUrls : undefined,
            options: {
                seed: Math.floor(Math.random() * 2147483647),
                stream: isCoze
            }
        }, isCoze ? async (chunk) => {
            if (chunk.text) {
                setGenerationHistory((prev: Generation[]) => prev.map(item =>
                    item.id === uniqueId ? { ...item, llmResponse: (item.llmResponse || "") + chunk.text } : item
                ));
            }
            if (chunk.images && chunk.images.length > 0) {
                const savePromises = chunk.images
                    .filter(imgUrl => !processedImages.has(imgUrl))
                    .map(async (imgUrl) => {
                        processedImages.add(imgUrl);
                        try {
                            const metadataConfig = { ...unified, model: modelId, baseModel: modelId, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            delete (metadataConfig as any).tldrawSnapshot;

                            const savedPath = await saveImageToOutputs(imgUrl, {
                                config: metadataConfig,
                                createdAt: generationTime,
                                sourceImageUrl: effectiveSourceUrl,
                                sourceImageUrls: effectiveSourceUrls,
                                localSourceId: effectiveLocalId,
                                localSourceIds: effectiveLocalIds,
                                baseModel: modelId,
                            });
                            lastSavedPath = savedPath;
                            setGenerationHistory((prev: Generation[]) => prev.map(item =>
                                item.id === uniqueId ? {
                                    ...item,
                                    outputUrl: savedPath,
                                    status: 'completed',
                                    config: { ...item.config, editConfig: effectiveEditConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId, sourceImageUrls: effectiveSourceUrls, isPreset: !!currentConfig.presetName }
                                } : item
                            ));
                        } catch (err) { console.error("Failed to save streamed image:", err); }
                    });
                await Promise.all(savePromises);
            }
        } : undefined);

        if (isCoze) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalItemInState = usePlaygroundStore.getState().generationHistory.find(h => h.id === uniqueId);
            if (finalItemInState) {
                const finalOutputUrl = lastSavedPath || finalItemInState.outputUrl;
                const itemToSave = {
                    ...finalItemInState,
                    config: { ...finalItemInState.config, loras: undefined, workflowName: undefined },
                    outputUrl: finalOutputUrl,
                    status: finalOutputUrl ? 'completed' : finalItemInState.status
                } as Generation;
                updateHistoryAndSave(uniqueId, itemToSave);
                return itemToSave;
            }
        } else if (res?.images && res.images.length > 0) {
            const dataUrl = res.images[0];
            const metadataConfig = { ...unified, model: modelId, baseModel: modelId, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (metadataConfig as any).tldrawSnapshot;

            const savedPath = await saveImageToOutputs(dataUrl, {
                config: metadataConfig,
                createdAt: generationTime,
                sourceImageUrl: effectiveSourceUrl,
                sourceImageUrls: effectiveSourceUrls,
                localSourceId: effectiveLocalId,
                localSourceIds: effectiveLocalIds,
                baseModel: modelId,
            });
            const gen: Generation = {
                id: uniqueId,
                userId: userStore.currentUser?.id || usePlaygroundStore.getState().visitorId || 'anonymous',
                projectId: projectStore.currentProjectId || 'default',
                outputUrl: savedPath,
                config: { ...unified, model: modelId, baseModel: modelId, loras: undefined, workflowName: undefined, presetName: currentConfig.presetName, sourceImageUrls: effectiveSourceUrls, localSourceIds: effectiveLocalIds, editConfig: effectiveEditConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId, isPreset: !!currentConfig.presetName },
                status: 'completed',
                createdAt: generationTime,
            };
            updateHistoryAndSave(uniqueId, gen);
            return gen;
        } else {
            throw new Error(`${selectedModel} returned empty result`);
        }
    }, [selectedModel, setGenerationHistory, updateHistoryAndSave, callImage, toast, saveImageToOutputs]);

    const handleWorkflow = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        if (!selectedWorkflowConfig) throw new Error("未选择工作流");

        // Guard against incomplete workflow data (lightweight presets not fully hydrated)
        if (!selectedWorkflowConfig.workflowApiJSON) {
            console.error("[Generation] Missing workflowApiJSON for workflow:", selectedWorkflowConfig.viewComfyJSON?.title);
            throw new Error("工作流数据不完整，正在重新加载，请稍后重试");
        }

        console.log("[Generation] Starting handleWorkflow:", { uniqueId, taskId, workflowTitle: selectedWorkflowConfig.viewComfyJSON.title });

        const effectiveSourceUrls = sourceImageUrls.length > 0 ? sourceImageUrls : usePlaygroundStore.getState().uploadedImages.map(img => img.path || img.previewUrl);
        const effectiveLocalId = localSourceId || (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages[0]?.id : undefined);
        const effectiveLocalIds = localSourceIds.length > 0 ? localSourceIds : (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages.map(img => img.id).filter((id): id is string => !!id) : []);
        const effectiveSourceUrl = effectiveSourceUrls[0];
        const flattenInputs = (arr: IMultiValueInput[]) => (arr || []).flatMap(g => (g.inputs || []).map(i => ({ key: i.key, value: i.value, valueType: i.valueType, title: i.title })));
        const allInputs = [...flattenInputs(selectedWorkflowConfig.viewComfyJSON.inputs), ...flattenInputs(selectedWorkflowConfig.viewComfyJSON.advancedInputs)];
        const mappingConfig = selectedWorkflowConfig.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;

        const isWorkflowId = (id?: string) => !id || id === 'Workflow' || id.startsWith('wf_');

        let mappedInputs: { key: string; value: unknown }[] = [];
        if (mappingConfig?.components?.length) {
            console.log("[Generation] Using MappingConfig to map parameters");
            const paramMap = new Map<string, unknown>();
            mappingConfig.components.forEach(comp => {
                if (!comp.properties?.paramName || !comp.mapping?.workflowPath) return;
                const pathKey = comp.mapping.workflowPath.join("-");
                const paramName = comp.properties.paramName;

                if (paramName === 'prompt' && currentConfig.prompt) paramMap.set(pathKey, currentConfig.prompt);
                else if (paramName === 'width') paramMap.set(pathKey, Math.floor(Number(currentConfig.width) || 1024));
                else if (paramName === 'height') paramMap.set(pathKey, Math.floor(Number(currentConfig.height) || 1024));
                else if (paramName === 'base_model' || paramName === 'model') {
                    const modelToMap = !isWorkflowId(currentConfig.model) ? currentConfig.model : (!isWorkflowId(currentConfig.baseModel) ? currentConfig.baseModel : '');
                    if (modelToMap) paramMap.set(pathKey, modelToMap);
                }
                else if (paramName === 'lora1' && currentConfig.loras?.[0]) paramMap.set(pathKey, currentConfig.loras[0].model_name);
                else if (paramName === 'lora1_strength' && currentConfig.loras?.[0]) paramMap.set(pathKey, Number(currentConfig.loras[0].strength));
                else if (paramName === 'lora2' && currentConfig.loras?.[1]) paramMap.set(pathKey, currentConfig.loras[1].model_name);
                else if (paramName === 'lora2_strength' && currentConfig.loras?.[1]) paramMap.set(pathKey, Number(currentConfig.loras[1].strength));
                else if (paramName === 'seed' && currentConfig.seed !== undefined) {
                    const seedVal = currentConfig.seed === -1 ? Math.floor(Math.random() * 1000000000000) : Number(currentConfig.seed);
                    paramMap.set(pathKey, seedVal);
                }
                else if (paramName === 'batch_size' && currentConfig.batchSize !== undefined) paramMap.set(pathKey, Math.max(1, Math.floor(Number(currentConfig.batchSize))));
                else if (paramName === 'sourceImageUrl') paramMap.set(pathKey, effectiveSourceUrl || '');
                else if (/^sourceImageUrl\d+$/.test(paramName)) {
                    const index = Number(paramName.replace('sourceImageUrl', '')) - 1;
                    const value = Number.isFinite(index) ? (effectiveSourceUrls[index] || '') : '';
                    paramMap.set(pathKey, value);
                }
            });


            // 1. Map existing inputs
            mappedInputs = allInputs.map(item => ({ key: item.key, value: paramMap.has(item.key) ? paramMap.get(item.key) : item.value }));

            // 2. Add mapped parameters that are missing from allInputs (e.g. for workflows with empty input definitions)
            // This is critical for Flux/Klein workflows where inputs might not be fully enumerated in the specific JSON
            paramMap.forEach((value, key) => {
                if (!mappedInputs.find(i => i.key === key)) {
                    mappedInputs.push({ key, value });
                }
            });
        } else {
            console.log("[Generation] No MappingConfig, falling back to fuzzy matching");
            mappedInputs = allInputs.map(item => {
                const title = item.title || "";
                if (/prompt|文本|提示/i.test(title)) return { key: item.key, value: currentConfig.prompt };
                if (/width/i.test(title)) return { key: item.key, value: Math.floor(Number(currentConfig.width) || 1024) };
                if (/height/i.test(title)) return { key: item.key, value: Math.floor(Number(currentConfig.height) || 1024) };
                if (/seed|种子/i.test(title)) {
                    const seedVal = currentConfig.seed === -1 ? Math.floor(Math.random() * 1000000000000) : Number(currentConfig.seed);
                    return { key: item.key, value: seedVal };
                }
                if (/batch_size|批次|数量/i.test(title)) return { key: item.key, value: Math.max(1, Math.floor(Number(currentConfig.batchSize) || 1)) };
                if (/model|模型|checkpoint/i.test(title)) {
                    const modelToMap = !isWorkflowId(currentConfig.model) ? currentConfig.model : (!isWorkflowId(currentConfig.baseModel) ? currentConfig.baseModel : '');
                    if (modelToMap) return { key: item.key, value: modelToMap };
                }
                return { key: item.key, value: item.value };
            });
        }

        console.log("[Generation] Final mappedInputs for ComfyUI:", mappedInputs);

        await new Promise<void>((resolve, reject) => {
            console.log("[Generation] Executing runComfyWorkflow API...");
            runComfyWorkflow({
                viewComfy: { inputs: mappedInputs as { key: string; value: string | number | boolean | File; }[], textOutputEnabled: selectedWorkflowConfig.viewComfyJSON.textOutputEnabled ?? false },
                workflow: selectedWorkflowConfig.workflowApiJSON,
                viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint,
                onSuccess: async (blobs) => {
                    try {
                        if (blobs && blobs.length > 0) {
                            const dataUrl = await blobToDataURL(blobs[0]);
                            const metadataConfig = { ...currentConfig, model: MODEL_ID_WORKFLOW, baseModel: currentConfig.model || MODEL_ID_WORKFLOW, workflowName: selectedWorkflowConfig.viewComfyJSON.title, loras: usePlaygroundStore.getState().selectedLoras, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            delete (metadataConfig as any).tldrawSnapshot;

                            const savedPath = await saveImageToOutputs(dataUrl, {
                                config: metadataConfig,
                                createdAt: generationTime,
                                sourceImageUrl: effectiveSourceUrl,
                                sourceImageUrls: effectiveSourceUrls,
                                localSourceId: effectiveLocalId,
                                localSourceIds: effectiveLocalIds,
                                baseModel: currentConfig.model || MODEL_ID_WORKFLOW,
                            });
                            const gen: Generation = {
                                id: uniqueId,
                                userId: userStore.currentUser?.id || usePlaygroundStore.getState().visitorId || 'anonymous',
                                projectId: projectStore.currentProjectId || 'default',
                                outputUrl: savedPath,
                                config: { ...toUnifiedConfigFromLegacy(currentConfig), model: MODEL_ID_WORKFLOW, baseModel: currentConfig.model || MODEL_ID_WORKFLOW, workflowName: selectedWorkflowConfig.viewComfyJSON.title, loras: usePlaygroundStore.getState().selectedLoras, presetName: currentConfig.presetName, sourceImageUrls: effectiveSourceUrls, localSourceIds: effectiveLocalIds, editConfig: currentConfig.editConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId },
                                status: 'completed',
                                createdAt: generationTime,
                            };
                            updateHistoryAndSave(uniqueId, gen);
                            resolve();
                        } else reject(new Error("工作流未返回图片结果"));
                    } catch (e) { reject(e); }
                },
                onError: (err) => reject(err)
            });
        });
        return usePlaygroundStore.getState().generationHistory.find(h => h.id === uniqueId);
    }, [selectedWorkflowConfig, updateHistoryAndSave, runComfyWorkflow, blobToDataURL, saveImageToOutputs]);

    const executeGeneration = useCallback(async (uniqueId: string, taskId: string, finalConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        const unifiedCfg = toUnifiedConfigFromLegacy(finalConfig);
        const effectiveModel = unifiedCfg.model || selectedModel;
        const isWorkflow = isWorkflowModel(effectiveModel, !!selectedWorkflowConfig);

        try {
            if (isMockMode) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                const result: Generation = { id: uniqueId, userId: userStore.currentUser?.id || usePlaygroundStore.getState().visitorId || 'anonymous', projectId: projectStore.currentProjectId || 'default', outputUrl: mockImageUrl, config: { prompt: unifiedCfg.prompt, width: unifiedCfg.width, height: unifiedCfg.height, model: unifiedCfg.model, loras: isWorkflow ? usePlaygroundStore.getState().selectedLoras : undefined, isPreset: !!(unifiedCfg.presetName), workflowName: isWorkflow ? usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined : undefined, sourceImageUrls: sourceImageUrls, localSourceIds: localSourceIds, taskId: taskId }, status: 'completed', createdAt: new Date().toISOString() };
                updateHistoryAndSave(uniqueId, result);
                return result;
            }
            if (isWorkflow) return await handleWorkflow(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
            else return await handleUnifiedImageGen(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
        } catch (err) {
            console.error("Generation failed:", err);
            setGenerationHistory(prev => prev.filter(item => item.id !== uniqueId));
            toast({ title: "生成失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
            return undefined;
        }
    }, [isMockMode, selectedModel, handleWorkflow, handleUnifiedImageGen, updateHistoryAndSave, setGenerationHistory, toast, selectedWorkflowConfig]);

    const handleGenerate = useCallback(async (options: GenerateOptions = {}) => {
        const { configOverride, fixedCreatedAt, isBackground } = options;
        const generationTime = fixedCreatedAt || new Date().toISOString();
        const freshConfig = usePlaygroundStore.getState().config;
        const currentLoras = usePlaygroundStore.getState().selectedLoras;
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
        const sourceImageUrls = options.sourceImageUrls || currentUploadedImages.map(img => img.path || img.previewUrl);
        const localSourceIds = options.localSourceIds || currentUploadedImages.map(img => img.id).filter((id): id is string => !!id);
        const localSourceId = localSourceIds[0];
        const editConfig = options.editConfig || configOverride?.editConfig || freshConfig.editConfig;
        const isEdit = options.isEdit !== undefined ? options.isEdit : (configOverride?.isEdit || freshConfig.isEdit || false);
        const sourceImageUrl = sourceImageUrls[0];
        const width = configOverride?.width || freshConfig.width;
        const height = configOverride?.height || freshConfig.height;

        const displayEditConfig = isEdit ? (editConfig ? {
            ...editConfig,
            referenceImages: sourceImageUrls.map((url, idx) => ({ id: editConfig.referenceImages?.[idx]?.id || `ref-${idx}`, dataUrl: url, label: editConfig.referenceImages?.[idx]?.label || `Image ${idx + 1}` })),
            originalImageUrl: sourceImageUrl || editConfig.originalImageUrl || '',
        } : (sourceImageUrls.length > 0 ? { canvasJson: {}, referenceImages: sourceImageUrls.map((url, idx) => ({ id: `ref-${idx}`, dataUrl: url, label: `Image ${idx + 1}` })), originalImageUrl: sourceImageUrl || '', annotations: [], backgroundColor: 'transparent', canvasSize: { width: Number(width), height: Number(height) } } : undefined)) : undefined;

        const parentId = options.parentId || configOverride?.parentId || freshConfig.parentId;
        const taskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));
        const combinedConfig = { ...freshConfig, ...(configOverride && typeof configOverride === 'object' ? configOverride : {}) };
        const unifiedCfg = toUnifiedConfigFromLegacy(combinedConfig);
        const effectiveModel = unifiedCfg.model || usePlaygroundStore.getState().selectedModel;
        const isWorkflow = isWorkflowModel(effectiveModel);

        let finalPresetName = combinedConfig.presetName;
        if (!finalPresetName && isWorkflow) finalPresetName = combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title;

        const finalConfig: GenerationConfig = { ...combinedConfig, loras: currentLoras, presetName: finalPresetName, baseModel: effectiveModel, workflowName: isWorkflow ? (combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title) : undefined, editConfig: displayEditConfig, isEdit, parentId };
        setHasGenerated(true);
        const configForHistory = { ...finalConfig };
        if (!isWorkflow) { configForHistory.loras = undefined; configForHistory.workflowName = undefined; }
        const uniqueId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const loadingGen: Generation = { id: uniqueId, userId: userStore.currentUser?.id || usePlaygroundStore.getState().visitorId || 'anonymous', projectId: projectStore.currentProjectId || 'default', outputUrl: "", config: { ...configForHistory, sourceImageUrls, localSourceIds, baseModel: effectiveModel, editConfig: displayEditConfig, isEdit, parentId, taskId, isPreset: !!(finalConfig.presetName) }, status: 'pending', createdAt: generationTime };
        setGenerationHistory((prev: Generation[]) => [loadingGen, ...prev]);
        if (isBackground) return uniqueId;
        return await executeGeneration(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
    }, [setHasGenerated, setGenerationHistory, executeGeneration]);

    const syncHistoryConfig = useCallback(async (updates: { id?: string; taskId?: string; config: Partial<GenerationConfig> }) => {
        const { id, taskId, config: newConfig } = updates;

        setGenerationHistory((prev: Generation[]) => {
            const newHistory = prev.map(item => {
                const match = (id && item.id === id) || (taskId && item.config?.taskId === taskId);
                if (match) {
                    return { ...item, config: { ...item.config, ...newConfig } };
                }
                return item;
            });

            // Sync matched items to backend
            const matchedItems = newHistory.filter(item => (id && item.id === id) || (taskId && item.config?.taskId === taskId));
            matchedItems.forEach(async (item) => {
                try {
                    await fetch(`${getApiBase()}/history`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item),
                    });
                } catch (err) {
                    console.error('Failed to sync history item:', item.id, err);
                }
            });

            return newHistory;
        });
    }, [setGenerationHistory]);

    return { handleGenerate, executeGeneration, syncHistoryConfig, isGenerating: isGenerating || isAIProcessing || isWorkflowProcessing, isLoading: isAIProcessing || isWorkflowProcessing };
}
