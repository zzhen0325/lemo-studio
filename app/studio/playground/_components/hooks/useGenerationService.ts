"use client";

import { useCallback, useState } from "react";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { userStore } from "@/lib/store/user-store";
import { useAIService } from "@/hooks/ai/useAIService";
import { useToast } from "@/hooks/common/use-toast";
import { GenerationConfig, EditPresetConfig } from "@/lib/playground/types";
import { Generation } from "@/types/database";
import { IMultiValueInput } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { usePostPlayground } from "@studio/playground/_hooks/use-post-playground";
import { usePostFluxKlein } from "@studio/playground/_hooks/use-post-fluxklein";
import { toUnifiedConfigFromLegacy } from "@/lib/adapters/data-mapping";
import { getApiBase } from "@/lib/api-base";
import { getBannerTemplateById } from "@/config/banner-templates";
import { MODEL_ID_FLUX_KLEIN, MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";

export interface UnifiedModelConfig {
    id: string;
    displayName: string;
}

export const AVAILABLE_MODELS: UnifiedModelConfig[] = [
    { id: 'gemini-3-pro-image-preview', displayName: 'Nano banana pro' },
    { id: 'gemini-3.1-flash-image-preview', displayName: 'Nano banana 2' },
    { id: 'gemini-2.5-flash-image', displayName: 'Nano banana' },

    { id: 'coze_seed4', displayName: 'Seedream 4' },
    // { id: 'seed4_lemo1230', displayName: 'Seed 4.0' },
    { id: 'seed4_2_lemo', displayName: 'Seed4 ' },
    { id: 'lemo_2dillustator', displayName: 'Seed3 Lemo' },
    // { id: 'lemoseedt2i', displayName: 'Seed 4' },
    { id: MODEL_ID_FLUX_KLEIN, displayName: 'FluxKlein' },

];

const GOOGLE_IMAGE_SIZE_MODELS = new Set([
    'gemini-3-pro-image-preview',
    'gemini-3.1-flash-image-preview',
]);

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
    const { doPost: runFluxKleinWorkflow } = usePostFluxKlein();
    const resolveEffectiveUserId = useCallback(() => {
        const sessionUserId = typeof window !== 'undefined' ? localStorage.getItem('CURRENT_USER_ID') : null;
        return userStore.currentUser?.id || sessionUserId || usePlaygroundStore.getState().visitorId || 'anonymous';
    }, []);

    // Helper: URL to DataURL
    const blobToDataURL = useCallback((blob: Blob) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    }), []);

    const fetchImageAsDataUrl = useCallback(async (url: string): Promise<string | null> => {
        if (!url.startsWith('http')) return null;

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
                cache: 'no-store',
            });

            if (!response.ok) return null;
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.startsWith('image/')) return null;

            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) return null;
            return await blobToDataURL(blob);
        } catch (err) {
            console.warn('[useGenerationService] Failed to convert remote image to data URL:', url, err);
            return null;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }, [blobToDataURL]);

    const toPreviewUrl = useCallback(async (imageUrl: string): Promise<string> => {
        if (!imageUrl.startsWith('data:')) return imageUrl;
        try {
            const blob = await fetch(imageUrl).then(resp => resp.blob());
            return URL.createObjectURL(blob);
        } catch (err) {
            console.error('[toPreviewUrl] Failed to build blob preview URL:', err);
            return imageUrl;
        }
    }, []);

    const revokeIfBlobUrl = useCallback((url: string) => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }, []);

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

        const uploadedImages = usePlaygroundStore.getState().uploadedImages;
        const effectiveInputImages = effectiveSourceUrls.map((url, idx) => {
            const localId = effectiveLocalIds[idx];
            const matchedByLocalId = localId ? uploadedImages.find(img => img.id === localId) : undefined;
            const matchedByUrl = uploadedImages.find(img => img.path === url || img.previewUrl === url);
            const matched = matchedByLocalId || matchedByUrl;

            // Prefer local data URL for model input to avoid server-side remote fetch instability.
            if (matched?.previewUrl?.startsWith('data:')) {
                return matched.previewUrl;
            }

            return url;
        });

        const normalizedInputImages = await Promise.all(effectiveInputImages.map(async (inputUrl) => {
            if (!inputUrl.startsWith('http')) return inputUrl;
            if (!/tiktokcdn\.com/i.test(inputUrl)) return inputUrl;

            const asDataUrl = await fetchImageAsDataUrl(inputUrl);
            return asDataUrl || inputUrl;
        }));

        const effectiveSourceUrl = effectiveSourceUrls[0];
        const effectiveInputImage = normalizedInputImages[0];
        const unified = toUnifiedConfigFromLegacy(currentConfig);
        const modelId = unified.model || selectedModel || "gemini-3-pro-image-preview";

        if (modelId === "seed4_2_lemo") {
            if (Number(unified.width) < 1024 || Number(unified.height) < 1024) {
                toast({ title: "尺寸限制", description: "Seed 4.2 模型的宽高尺寸不能小于 1024px", variant: "destructive" });
                throw new Error("Seed 4.2 dimension validation failed");
            }
        }

        const isCoze = modelId === "coze_seed4";
        const processedImages = new Set<string>();
        const pendingSaveTasks: Promise<void>[] = [];
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

        const metadataConfig: Record<string, unknown> = { ...unified, model: modelId, baseModel: modelId, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
        delete metadataConfig.tldrawSnapshot;
        delete metadataConfig.imageEditorSession;

        const finalGenConfig = { ...unified, model: modelId, baseModel: modelId, loras: undefined, workflowName: undefined, presetName: currentConfig.presetName, sourceImageUrls: effectiveSourceUrls, localSourceIds: effectiveLocalIds, editConfig: effectiveEditConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId, isPreset: !!currentConfig.presetName };

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            aspectRatio: unified.aspectRatio === 'auto' ? undefined : unified.aspectRatio,
            imageSize: GOOGLE_IMAGE_SIZE_MODELS.has(modelId) ? unified.imageSize : undefined,
            batchSize: 1,
            image: effectiveInputImage,
            images: normalizedInputImages.length > 0 ? normalizedInputImages : undefined,
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
                for (const imgUrl of chunk.images.filter(url => !processedImages.has(url))) {
                    processedImages.add(imgUrl);
                    const previewUrl = await toPreviewUrl(imgUrl);
                    setGenerationHistory((prev: Generation[]) => prev.map(item =>
                        item.id === uniqueId ? {
                            ...item,
                            outputUrl: previewUrl,
                            status: 'completed',
                            config: { ...item.config, ...finalGenConfig }
                        } : item
                    ));

                    const saveTask = (async () => {
                        let shouldRevokePreview = false;
                        try {
                            const savedPath = await saveImageToOutputs(imgUrl, {
                                config: metadataConfig,
                                createdAt: generationTime,
                                sourceImageUrl: effectiveSourceUrl,
                                sourceImageUrls: effectiveSourceUrls,
                                localSourceId: effectiveLocalId,
                                localSourceIds: effectiveLocalIds,
                                baseModel: modelId,
                            });
                            if (!savedPath) return;
                            lastSavedPath = savedPath;
                            const latestItem = usePlaygroundStore.getState().generationHistory.find(h => h.id === uniqueId);
                            if (!latestItem) return;
                            updateHistoryAndSave(uniqueId, {
                                ...latestItem,
                                config: { ...latestItem.config, loras: undefined, workflowName: undefined },
                                outputUrl: savedPath,
                                status: 'completed'
                            } as Generation);
                            shouldRevokePreview = savedPath !== previewUrl;
                        } catch (err) {
                            console.error("Failed to save streamed image:", err);
                        } finally {
                            if (shouldRevokePreview) revokeIfBlobUrl(previewUrl);
                        }
                    })();
                    pendingSaveTasks.push(saveTask);
                }
            }
        } : undefined);

        if (isCoze) {
            await Promise.allSettled(pendingSaveTasks);
            const finalItemInState = usePlaygroundStore.getState().generationHistory.find(h => h.id === uniqueId);
            if (finalItemInState) {
                if (lastSavedPath && finalItemInState.outputUrl !== lastSavedPath) {
                    const itemToSave = {
                        ...finalItemInState,
                        config: { ...finalItemInState.config, loras: undefined, workflowName: undefined },
                        outputUrl: lastSavedPath,
                        status: 'completed'
                    } as Generation;
                    updateHistoryAndSave(uniqueId, itemToSave);
                    return itemToSave;
                }
                return finalItemInState;
            }
            throw new Error(`${selectedModel} returned empty result`);
        }
        if (res?.images && res.images.length > 0) {
            const dataUrl = res.images[0];
            const previewUrl = await toPreviewUrl(dataUrl);
            const effectiveUserId = resolveEffectiveUserId();
            const previewGen: Generation = {
                id: uniqueId,
                userId: effectiveUserId,
                projectId: 'default',
                outputUrl: previewUrl,
                config: finalGenConfig,
                status: 'completed',
                createdAt: generationTime,
            };
            setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === uniqueId ? {
                ...item,
                ...previewGen,
                id: uniqueId,
                userId: item.userId,
                projectId: item.projectId,
                createdAt: item.createdAt,
            } : item));

            void (async () => {
                let shouldRevokePreview = false;
                try {
                    const savedPath = await saveImageToOutputs(dataUrl, {
                        config: metadataConfig,
                        createdAt: generationTime,
                        sourceImageUrl: effectiveSourceUrl,
                        sourceImageUrls: effectiveSourceUrls,
                        localSourceId: effectiveLocalId,
                        localSourceIds: effectiveLocalIds,
                        baseModel: modelId,
                    });
                    if (!savedPath) return;
                    updateHistoryAndSave(uniqueId, {
                        ...previewGen,
                        outputUrl: savedPath,
                    });
                    shouldRevokePreview = savedPath !== previewUrl;
                } catch (err) {
                    console.error("Unified save-image background task failed:", err);
                } finally {
                    if (shouldRevokePreview) revokeIfBlobUrl(previewUrl);
                }
            })();
            return previewGen;
        }
        throw new Error(`${selectedModel} returned empty result`);
    }, [selectedModel, setGenerationHistory, updateHistoryAndSave, callImage, toast, saveImageToOutputs, toPreviewUrl, revokeIfBlobUrl, fetchImageAsDataUrl, resolveEffectiveUserId]);

    const handleWorkflow = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        if (!selectedWorkflowConfig) throw new Error("未选择工作流");

        // Guard against incomplete workflow data (lightweight presets not fully hydrated)
        if (!selectedWorkflowConfig.workflowApiJSON) {
            console.error("[Generation] Missing workflowApiJSON for workflow:", selectedWorkflowConfig.viewComfyJSON?.title);
            throw new Error("工作流数据不完整，正在重新加载，请稍后重试");
        }

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

        const previewResult = await new Promise<Generation>((resolve, reject) => {
            runComfyWorkflow({
                viewComfy: { inputs: mappedInputs as { key: string; value: string | number | boolean | File; }[], textOutputEnabled: selectedWorkflowConfig.viewComfyJSON.textOutputEnabled ?? false },
                workflow: selectedWorkflowConfig.workflowApiJSON,
                viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint,
                onSuccess: async (blobs) => {
                    try {
                        if (blobs && blobs.length > 0) {
                            const metadataConfig = { ...currentConfig, model: MODEL_ID_WORKFLOW, baseModel: currentConfig.model || MODEL_ID_WORKFLOW, workflowName: selectedWorkflowConfig.viewComfyJSON.title, loras: usePlaygroundStore.getState().selectedLoras, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            delete (metadataConfig as any).tldrawSnapshot;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            delete (metadataConfig as any).imageEditorSession;
                            const previewUrl = URL.createObjectURL(blobs[0]);
                            const effectiveUserId = resolveEffectiveUserId();
                            const previewGen: Generation = {
                                id: uniqueId,
                                userId: effectiveUserId,
                                projectId: 'default',
                                outputUrl: previewUrl,
                                config: { ...toUnifiedConfigFromLegacy(currentConfig), model: MODEL_ID_WORKFLOW, baseModel: currentConfig.model || MODEL_ID_WORKFLOW, workflowName: selectedWorkflowConfig.viewComfyJSON.title, loras: usePlaygroundStore.getState().selectedLoras, presetName: currentConfig.presetName, sourceImageUrls: effectiveSourceUrls, localSourceIds: effectiveLocalIds, editConfig: currentConfig.editConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId },
                                status: 'completed',
                                createdAt: generationTime,
                            };
                            setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === uniqueId ? {
                                ...item,
                                ...previewGen,
                                id: uniqueId,
                                userId: item.userId,
                                projectId: item.projectId,
                                createdAt: item.createdAt,
                            } : item));
                            resolve(previewGen);
                            void (async () => {
                                let shouldRevokePreview = false;
                                try {
                                    const dataUrl = await blobToDataURL(blobs[0]);
                                    const savedPath = await saveImageToOutputs(dataUrl, {
                                        config: metadataConfig,
                                        createdAt: generationTime,
                                        sourceImageUrl: effectiveSourceUrl,
                                        sourceImageUrls: effectiveSourceUrls,
                                        localSourceId: effectiveLocalId,
                                        localSourceIds: effectiveLocalIds,
                                        baseModel: currentConfig.model || MODEL_ID_WORKFLOW,
                                    });
                                    if (!savedPath) return;
                                    updateHistoryAndSave(uniqueId, {
                                        ...previewGen,
                                        outputUrl: savedPath,
                                    });
                                    shouldRevokePreview = true;
                                } catch (e) {
                                    console.error("Workflow save-image background task failed:", e);
                                } finally {
                                    if (shouldRevokePreview) URL.revokeObjectURL(previewUrl);
                                }
                            })();
                        } else reject(new Error("工作流未返回图片结果"));
                    } catch (e) { reject(e); }
                },
                onError: (err) => reject(err)
            });
        });
        return previewResult;
    }, [selectedWorkflowConfig, updateHistoryAndSave, runComfyWorkflow, blobToDataURL, saveImageToOutputs, setGenerationHistory, resolveEffectiveUserId]);

    const handleFluxKlein = useCallback(async (uniqueId: string, taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        const effectiveSourceUrls = sourceImageUrls.length > 0 ? sourceImageUrls : usePlaygroundStore.getState().uploadedImages.map(img => img.path || img.previewUrl);
        const effectiveLocalId = localSourceId || (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages[0]?.id : undefined);
        const effectiveLocalIds = localSourceIds.length > 0 ? localSourceIds : (sourceImageUrls.length === 0 ? usePlaygroundStore.getState().uploadedImages.map(img => img.id).filter((id): id is string => !!id) : []);
        const effectiveSourceUrl = effectiveSourceUrls[0];
        const unified = toUnifiedConfigFromLegacy(currentConfig);
        const seedVal = currentConfig.seed === -1 ? Math.floor(Math.random() * 1000000000000) : (currentConfig.seed !== undefined ? Number(currentConfig.seed) : Math.floor(Math.random() * 1000000000000));
        const batchSize = Math.max(1, Math.floor(Number(currentConfig.batchSize) || 1));

        const previewResult = await new Promise<Generation>((resolve, reject) => {
            runFluxKleinWorkflow({
                prompt: unified.prompt,
                width: Math.floor(Number(unified.width) || 1024),
                height: Math.floor(Number(unified.height) || 1024),
                seed: seedVal,
                batchSize,
                referenceImages: effectiveSourceUrls,
                onSuccess: async (blobs) => {
                    try {
                        if (blobs && blobs.length > 0) {
                            const metadataConfig: Record<string, unknown> = { ...currentConfig, model: MODEL_ID_FLUX_KLEIN, baseModel: MODEL_ID_FLUX_KLEIN, localSourceId: effectiveLocalId, localSourceIds: effectiveLocalIds, presetName: currentConfig.presetName, isPreset: !!currentConfig.presetName };
                            delete metadataConfig.tldrawSnapshot;
                            delete metadataConfig.imageEditorSession;
                            const previewUrl = URL.createObjectURL(blobs[0]);
                            const effectiveUserId = resolveEffectiveUserId();
                            const previewGen: Generation = {
                                id: uniqueId,
                                userId: effectiveUserId,
                                projectId: 'default',
                                outputUrl: previewUrl,
                                config: { ...toUnifiedConfigFromLegacy(currentConfig), model: MODEL_ID_FLUX_KLEIN, baseModel: MODEL_ID_FLUX_KLEIN, presetName: currentConfig.presetName, sourceImageUrls: effectiveSourceUrls, localSourceIds: effectiveLocalIds, editConfig: currentConfig.editConfig, isEdit: currentConfig.isEdit, parentId: currentConfig.parentId, taskId: currentConfig.taskId || taskId },
                                status: 'completed',
                                createdAt: generationTime,
                            };
                            setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === uniqueId ? {
                                ...item,
                                ...previewGen,
                                id: uniqueId,
                                userId: item.userId,
                                projectId: item.projectId,
                                createdAt: item.createdAt,
                            } : item));
                            resolve(previewGen);
                            void (async () => {
                                let shouldRevokePreview = false;
                                try {
                                    const dataUrl = await blobToDataURL(blobs[0]);
                                    const savedPath = await saveImageToOutputs(dataUrl, {
                                        config: metadataConfig,
                                        createdAt: generationTime,
                                        sourceImageUrl: effectiveSourceUrl,
                                        sourceImageUrls: effectiveSourceUrls,
                                        localSourceId: effectiveLocalId,
                                        localSourceIds: effectiveLocalIds,
                                        baseModel: MODEL_ID_FLUX_KLEIN,
                                    });
                                    if (!savedPath) return;
                                    updateHistoryAndSave(uniqueId, {
                                        ...previewGen,
                                        outputUrl: savedPath,
                                    });
                                    shouldRevokePreview = true;
                                } catch (e) {
                                    console.error("FluxKlein save-image background task failed:", e);
                                } finally {
                                    if (shouldRevokePreview) URL.revokeObjectURL(previewUrl);
                                }
                            })();
                        } else reject(new Error("FluxKlein 未返回图片结果"));
                    } catch (e) { reject(e); }
                },
                onError: (err) => reject(err)
            });
        });
        return previewResult;
    }, [runFluxKleinWorkflow, blobToDataURL, saveImageToOutputs, updateHistoryAndSave, setGenerationHistory, resolveEffectiveUserId]);

    const executeGeneration = useCallback(async (uniqueId: string, taskId: string, finalConfig: GenerationConfig, generationTime: string, sourceImageUrls: string[] = [], localSourceId?: string, localSourceIds: string[] = []) => {
        const unifiedCfg = toUnifiedConfigFromLegacy(finalConfig);
        const effectiveModel = unifiedCfg.model || selectedModel;
        const isWorkflow = isWorkflowModel(effectiveModel, !!selectedWorkflowConfig);

        try {
            if (isMockMode) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                const effectiveUserId = resolveEffectiveUserId();
                const result: Generation = { id: uniqueId, userId: effectiveUserId, projectId: 'default', outputUrl: mockImageUrl, config: { prompt: unifiedCfg.prompt, width: unifiedCfg.width, height: unifiedCfg.height, model: unifiedCfg.model, loras: isWorkflow ? usePlaygroundStore.getState().selectedLoras : undefined, isPreset: !!(unifiedCfg.presetName), workflowName: isWorkflow ? usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined : undefined, sourceImageUrls: sourceImageUrls, localSourceIds: localSourceIds, taskId: taskId }, status: 'completed', createdAt: new Date().toISOString() };
                updateHistoryAndSave(uniqueId, result);
                return result;
            }
            if (effectiveModel === MODEL_ID_FLUX_KLEIN) return await handleFluxKlein(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
            if (isWorkflow) return await handleWorkflow(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
            else return await handleUnifiedImageGen(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
        } catch (err) {
            console.error("Generation failed:", err);
            setGenerationHistory(prev => prev.filter(item => item.id !== uniqueId));
            toast({ title: "生成失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
            return undefined;
        }
    }, [isMockMode, selectedModel, handleWorkflow, handleUnifiedImageGen, handleFluxKlein, updateHistoryAndSave, setGenerationHistory, toast, selectedWorkflowConfig, resolveEffectiveUserId]);

    const handleGenerate = useCallback(async (options: GenerateOptions = {}) => {
        const { configOverride, fixedCreatedAt, isBackground } = options;
        const generationTime = fixedCreatedAt || new Date().toISOString();
        const storeState = usePlaygroundStore.getState();
        const freshConfig = storeState.config;
        const currentLoras = storeState.selectedLoras;
        const currentUploadedImages = storeState.uploadedImages;
        let sourceImageUrls = options.sourceImageUrls || currentUploadedImages.map(img => img.path || img.previewUrl);
        let localSourceIds = options.localSourceIds || currentUploadedImages.map(img => img.id).filter((id): id is string => !!id);
        let localSourceId: string | undefined = localSourceIds[0];
        const taskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));
        const combinedConfig = { ...freshConfig, ...(configOverride && typeof configOverride === 'object' ? configOverride : {}) };

        const activeBannerData = storeState.activeTab === 'banner' ? storeState.activeBannerData : null;
        if (activeBannerData) {
            const template = getBannerTemplateById(activeBannerData.templateId);
            if (!template) {
                toast({ title: "Banner 生成失败", description: "未找到 Banner 模版配置", variant: "destructive" });
                return;
            }

            const promptFinal = (activeBannerData.promptFinal || '').trim();
            if (!promptFinal) {
                toast({ title: "Banner 生成失败", description: "最终 Prompt 为空，请先填写内容", variant: "destructive" });
                return;
            }

            sourceImageUrls = (options.sourceImageUrls && options.sourceImageUrls.length > 0)
                ? options.sourceImageUrls
                : [template.baseImageUrl];
            localSourceIds = [];
            localSourceId = undefined;

            combinedConfig.prompt = promptFinal;
            combinedConfig.model = activeBannerData.model;
            combinedConfig.baseModel = activeBannerData.model;
            combinedConfig.width = template.width;
            combinedConfig.height = template.height;
            combinedConfig.isEdit = true;
            combinedConfig.parentId = undefined;
            combinedConfig.editConfig = undefined;
            combinedConfig.generationMode = 'banner';
            combinedConfig.bannerTemplateId = template.id;
            combinedConfig.bannerFields = activeBannerData.fields;
            combinedConfig.bannerTextPositions = [];
            combinedConfig.bannerPromptFinal = promptFinal;
            combinedConfig.sourceImageUrls = sourceImageUrls;
            combinedConfig.isPreset = false;
            combinedConfig.presetName = undefined;
            combinedConfig.workflowName = undefined;
        }

        const editConfig = options.editConfig || configOverride?.editConfig || combinedConfig.editConfig || freshConfig.editConfig;
        const isEdit = options.isEdit !== undefined ? options.isEdit : Boolean(combinedConfig.isEdit);
        const width = combinedConfig.width || freshConfig.width;
        const height = combinedConfig.height || freshConfig.height;
        const parentId = options.parentId || configOverride?.parentId || combinedConfig.parentId;
        const finalLoras = activeBannerData ? [] : currentLoras;

        const sourceImageUrl = sourceImageUrls[0];
        const displayEditConfig = isEdit ? (editConfig ? {
            ...editConfig,
            referenceImages: sourceImageUrls.map((url, idx) => ({ id: editConfig.referenceImages?.[idx]?.id || `ref-${idx}`, dataUrl: url, label: editConfig.referenceImages?.[idx]?.label || `Image ${idx + 1}` })),
            // Keep the original editable base image stable for "Edit Again";
            // sourceImageUrl here can be the merged annotation image.
            originalImageUrl: editConfig.originalImageUrl || sourceImageUrl || '',
        } : (sourceImageUrls.length > 0 ? { canvasJson: {}, referenceImages: sourceImageUrls.map((url, idx) => ({ id: `ref-${idx}`, dataUrl: url, label: `Image ${idx + 1}` })), originalImageUrl: sourceImageUrl || '', annotations: [], backgroundColor: 'transparent', canvasSize: { width: Number(width), height: Number(height) } } : undefined)) : undefined;
        const unifiedCfg = toUnifiedConfigFromLegacy(combinedConfig);
        const effectiveModel = unifiedCfg.model || usePlaygroundStore.getState().selectedModel;
        const isWorkflow = isWorkflowModel(effectiveModel);

        let finalPresetName = combinedConfig.presetName;
        if (!finalPresetName && isWorkflow) finalPresetName = combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title;

        const finalConfig: GenerationConfig = {
            ...combinedConfig,
            loras: finalLoras,
            presetName: finalPresetName,
            baseModel: effectiveModel,
            workflowName: isWorkflow ? (combinedConfig.workflowName || usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title) : undefined,
            editConfig: displayEditConfig,
            isEdit,
            parentId
        };
        setHasGenerated(true);
        const configForHistory = { ...finalConfig };
        if (!isWorkflow) { configForHistory.loras = undefined; configForHistory.workflowName = undefined; }
        const uniqueId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        const effectiveUserId = resolveEffectiveUserId();
        const loadingGen: Generation = { id: uniqueId, userId: effectiveUserId, projectId: 'default', outputUrl: "", config: { ...configForHistory, sourceImageUrls, localSourceIds, baseModel: effectiveModel, editConfig: displayEditConfig, isEdit, parentId, taskId, isPreset: !!(finalConfig.presetName) }, status: 'pending', createdAt: generationTime };
        setGenerationHistory((prev: Generation[]) => [loadingGen, ...prev]);
        if (isBackground) return uniqueId;
        return await executeGeneration(uniqueId, taskId, finalConfig, generationTime, sourceImageUrls, localSourceId, localSourceIds);
    }, [setHasGenerated, setGenerationHistory, executeGeneration, toast, resolveEffectiveUserId]);

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
