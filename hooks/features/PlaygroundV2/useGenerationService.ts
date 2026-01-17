"use client";

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
}

export function useGenerationService() {
    const { toast } = useToast();

    const selectedModel = usePlaygroundStore(s => s.selectedModel);
    const selectedWorkflowConfig = usePlaygroundStore(s => s.selectedWorkflowConfig);
    const isMockMode = usePlaygroundStore(s => s.isMockMode);
    const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
    const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);
    const selectedPresetName = usePlaygroundStore(s => s.selectedPresetName);

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


    const handleGenerate = async (options: GenerateOptions = {}) => {
        const { configOverride, fixedCreatedAt, isBackground } = options;
        const generationTime = fixedCreatedAt || new Date().toISOString();
        const freshConfig = usePlaygroundStore.getState().config;
        const currentLoras = usePlaygroundStore.getState().selectedLoras;

        // Prioritize editConfig from options, then configOverride, then current config
        const editConfig = options.editConfig || configOverride?.editConfig || freshConfig.editConfig;

        const finalConfig = {
            ...(configOverride && typeof configOverride === 'object' && 'prompt' in configOverride
                ? configOverride
                : freshConfig),
            loras: currentLoras,
            presetName: selectedPresetName,
            editConfig // Ensure it's part of finalConfig
        };

        // Set state to indicate generation has started
        setHasGenerated(true);
        const taskId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

        const unifiedCfg = toUnifiedConfigFromLegacy(finalConfig);
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
        const firstImage = currentUploadedImages[0];
        const sourceImageUrl = firstImage ? (firstImage.path || firstImage.previewUrl) : undefined;

        const loadingGen: Generation = {
            id: taskId,
            userId: userStore.currentUser?.id || 'anonymous',
            projectId: projectStore.currentProjectId || 'default',
            outputUrl: "",
            config: unifiedCfg,
            status: 'pending',
            sourceImageUrl: sourceImageUrl,
            editConfig: editConfig,
            createdAt: generationTime,
        };

        // Use standard state update for history
        setGenerationHistory((prev: Generation[]) => [loadingGen, ...prev]);

        if (isBackground) return taskId;

        return executeGeneration(taskId, finalConfig, generationTime, sourceImageUrl);
    };

    const executeGeneration = async (taskId: string, finalConfig: GenerationConfig, generationTime: string, sourceImageUrl?: string) => {
        const unifiedCfg = toUnifiedConfigFromLegacy(finalConfig);
        try {
            if (isMockMode) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                const result: Generation = {
                    id: taskId,
                    userId: userStore.currentUser?.id || 'anonymous',
                    projectId: projectStore.currentProjectId || 'default',
                    outputUrl: mockImageUrl,
                    config: {
                        prompt: unifiedCfg.prompt,
                        width: unifiedCfg.width,
                        height: unifiedCfg.height,
                        model: unifiedCfg.model,
                        lora: unifiedCfg.lora,
                        loras: usePlaygroundStore.getState().selectedLoras,
                        workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                    },
                    status: 'completed',
                    sourceImageUrl: undefined,
                    createdAt: new Date().toISOString(),
                };
                updateHistoryAndSave(taskId, result);
                return;
            }

            // 优先使用 config 中的模型 ID
            const effectiveModel = unifiedCfg.model || selectedModel;

            if (effectiveModel === "Workflow") {
                await handleWorkflow(taskId, finalConfig, generationTime, sourceImageUrl);
            } else {
                await handleUnifiedImageGen(taskId, finalConfig, generationTime, sourceImageUrl);
            }
        } catch (err) {
            console.error("Generation failed:", err);
            // Cleanup on failure
            setGenerationHistory(prev => prev.filter(item => item.id !== taskId));
            toast({
                title: "生成失败",
                description: err instanceof Error ? err.message : "未知错误",
                variant: "destructive"
            });
        }
    };

    const updateHistoryAndSave = (taskId: string, result: Generation) => {
        setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === taskId ? {
            ...item,
            ...result,
            config: { ...item.config, ...result.config }
        } : item));
        saveHistoryToBackend(result);

        // Also sync to Gallery if it's visible or being cached
        usePlaygroundStore.getState().addGalleryItem(result);
    };

    const handleUnifiedImageGen = async (taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrl?: string) => {
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;

        // Calculate effective source URL preferring path (uploaded URL) over base64
        const firstImage = currentUploadedImages[0];
        const effectiveSourceUrl = firstImage ? (firstImage.path || firstImage.previewUrl) : sourceImageUrl;

        const unified = toUnifiedConfigFromLegacy(currentConfig);

        // 使用统一模型配置进行映射，优先使用 config 中的模型 ID
        const modelId = unified.model || selectedModel || "gemini-3-pro-image-preview";

        console.log(`[useGenerationService] selectedModel: ${selectedModel}, mapping to modelId: ${modelId}`);

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

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            aspectRatio: unified.aspectRatio === 'auto' ? undefined : unified.aspectRatio,
            batchSize: 1, // Single task per call now
            image: currentUploadedImages.length > 0 ? currentUploadedImages[0].previewUrl : undefined,
            options: {
                seed: Math.floor(Math.random() * 2147483647),
                stream: isCoze
            }
        }, isCoze ? async (chunk) => {
            console.log(`[useGenerationService] Received stream chunk:`, chunk);
            if (chunk.text) {
                setGenerationHistory((prev: Generation[]) => prev.map(item =>
                    item.id === taskId
                        ? { ...item, llmResponse: (item.llmResponse || "") + chunk.text }
                        : item
                ));
            }
            if (chunk.images && chunk.images.length > 0) {
                for (const imgUrl of chunk.images) {
                    if (processedImages.has(imgUrl)) continue;
                    processedImages.add(imgUrl);

                    try {
                        console.log(`[useGenerationService] Saving streamed image: ${imgUrl}`);
                        const savedPath = await saveImageToOutputs(
                            imgUrl,
                            {
                                config: {
                                    prompt: unified.prompt,
                                    width: Number(unified.width),
                                    height: Number(unified.height),
                                    model: unified.model || selectedModel,
                                    loras: usePlaygroundStore.getState().selectedLoras,
                                    workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                                },
                                createdAt: generationTime,
                                sourceImageUrl: effectiveSourceUrl,
                            }
                        );
                        lastSavedPath = savedPath;
                        console.log(`[useGenerationService] Streamed image saved to: ${savedPath}`);
                        setGenerationHistory((prev: Generation[]) => prev.map(item =>
                            item.id === taskId
                                ? { ...item, outputUrl: savedPath, status: 'completed', editConfig: currentConfig.editConfig }
                                : item
                        ));
                    } catch (err) {
                        console.error("Failed to save streamed image:", err);
                    }
                }
            }
        } : undefined);

        console.log(`[useGenerationService] callImage finished. isCoze: ${isCoze}`);

        if (isCoze) {
            console.log(`[useGenerationService] Coze stream call finished. lastSavedPath: ${lastSavedPath}`);
            // Wait for a small delay to ensure all state updates and async tasks are settled
            await new Promise(resolve => setTimeout(resolve, 500));
            const finalItemInState = usePlaygroundStore.getState().generationHistory.find(h => h.id === taskId);

            if (finalItemInState) {
                const finalOutputUrl = lastSavedPath || finalItemInState.outputUrl;
                if (!finalOutputUrl) {
                    console.warn(`[useGenerationService] Coze finished but no image URL was captured!`);
                }

                const itemToSave = {
                    ...finalItemInState,
                    outputUrl: finalOutputUrl,
                    status: finalOutputUrl ? 'completed' : finalItemInState.status
                } as Generation;

                console.log(`[useGenerationService] Finalizing Coze history with outputUrl: ${itemToSave.outputUrl}`);
                updateHistoryAndSave(taskId, itemToSave);
            }
        } else if (res?.images && res.images.length > 0) {
            const dataUrl = res.images[0];
            const savedPath = await saveImageToOutputs(
                dataUrl,
                {
                    config: {
                        prompt: unified.prompt,
                        width: Number(unified.width),
                        height: Number(unified.height),
                        model: unified.model || selectedModel,
                        lora: unified.lora,
                        loras: usePlaygroundStore.getState().selectedLoras,
                        workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                    },
                    createdAt: generationTime,
                    sourceImageUrl: effectiveSourceUrl,
                }
            );
            const gen: Generation = {
                id: taskId,
                userId: userStore.currentUser?.id || 'anonymous',
                projectId: projectStore.currentProjectId || 'default',
                outputUrl: savedPath,
                config: unified,
                status: 'completed',
                sourceImageUrl: effectiveSourceUrl,
                createdAt: generationTime,
                editConfig: currentConfig.editConfig,
            };
            updateHistoryAndSave(taskId, gen);
        } else {
            throw new Error(`${selectedModel} returned empty result`);
        }
    };

    const handleWorkflow = async (taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrl?: string) => {
        if (!selectedWorkflowConfig) throw new Error("未选择工作流");

        // Calculate effective source URL preferring path (uploaded URL) over base64
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
        const firstImage = currentUploadedImages[0];
        const effectiveSourceUrl = firstImage ? (firstImage.path || firstImage.previewUrl) : sourceImageUrl;

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

        const getWorkflowValue = (path: string[]) => {
            if (!selectedWorkflowConfig?.workflowApiJSON) return undefined;
            const [nodeId, section, key] = path;
            const wf: Record<string, { inputs?: Record<string, unknown> }> = selectedWorkflowConfig.workflowApiJSON as unknown as Record<string, { inputs?: Record<string, unknown> }>;
            const node = wf[nodeId];
            if (!node || section !== 'inputs') return undefined;
            return node.inputs?.[key];
        };
        const extractModelFromMapping = () => {
            const comps = selectedWorkflowConfig.viewComfyJSON.mappingConfig?.components as { properties?: { paramName?: string }, mapping?: { workflowPath: string[] } }[] | undefined;
            const modelComp = comps?.find(c => c.properties?.paramName === 'model');
            if (modelComp?.mapping?.workflowPath) {
                const val = getWorkflowValue(modelComp.mapping.workflowPath);
                if (typeof val === 'string' && val) return val;
            }
            // Fallback: scan inputs by title
            const all = [...(selectedWorkflowConfig.viewComfyJSON.inputs || []), ...(selectedWorkflowConfig.viewComfyJSON.advancedInputs || [])];
            for (const group of all) {
                for (const i of group.inputs) {
                    const t = (i.title || '').toLowerCase();
                    if (t.includes('model') || t.includes('checkpoint') || t.includes('ckpt') || t.includes('模型')) {
                        if (typeof i.value === 'string' && i.value) return i.value;
                    }
                }
            }
            // Final fallback: scan workflowApiJSON nodes for checkpoint-like strings
            const wf: Record<string, { class_type?: string; inputs?: Record<string, unknown> }> =
                selectedWorkflowConfig.workflowApiJSON as unknown as Record<string, { class_type?: string; inputs?: Record<string, unknown> }>;
            const candidates: string[] = [];
            const isCkpt = (s: string) => /\.safetensors$/i.test(s) || s.toLowerCase().includes('safetensors');
            const likelyKeys = new Set(['ckpt_name', 'model', 'checkpoint', 'base_model']);
            Object.values(wf).forEach(node => {
                const inputs = node.inputs || {};
                Object.entries(inputs).forEach(([k, v]) => {
                    if (typeof v === 'string') {
                        if (isCkpt(v) || likelyKeys.has(k)) candidates.push(v);
                    }
                });
            });
            if (candidates.length) return candidates[0];
            return 'Workflow';
        };

        await runComfyWorkflow({
            viewComfy: { inputs: mappedInputs, textOutputEnabled: false },
            workflow: selectedWorkflowConfig.workflowApiJSON || undefined,
            viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint || null,
            onSuccess: async (outputs) => {
                if (outputs.length > 0) {
                    const dataUrl = await blobToDataURL(outputs[0]);
                    const unified = toUnifiedConfigFromLegacy({
                        ...currentConfig,
                        model: extractModelFromMapping(),
                    });
                    const savedPath = await saveImageToOutputs(
                        dataUrl,
                        {
                            config: {
                                ...unified,
                                loras: usePlaygroundStore.getState().selectedLoras,
                            },
                            createdAt: generationTime,
                            sourceImageUrl: effectiveSourceUrl,
                        }
                    );
                    const gen: Generation = {
                        id: taskId,
                        userId: userStore.currentUser?.id || 'anonymous',
                        projectId: projectStore.currentProjectId || 'default',
                        outputUrl: savedPath,
                        config: {
                            ...unified,
                            loras: usePlaygroundStore.getState().selectedLoras,
                            workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                        },
                        status: 'completed',
                        sourceImageUrl: effectiveSourceUrl,
                        createdAt: generationTime,
                        editConfig: currentConfig.editConfig
                    };
                    updateHistoryAndSave(taskId, gen);
                }
            },
            onError: (err) => {
                setGenerationHistory(prev => prev.filter(item => item.id !== taskId));
                toast({ title: "生成失败", description: err?.message || "工作流执行失败", variant: "destructive" });
            }
        });
    };


    return {
        handleGenerate,
        executeGeneration,
        isGenerating: isAIProcessing || isWorkflowProcessing
    };
}
