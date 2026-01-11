"use client";

import { usePlaygroundStore } from "@/lib/store/playground-store";
import { projectStore } from "@/lib/store/project-store";
import { useAIService } from "@/hooks/ai/useAIService";
import { useToast } from "@/hooks/common/use-toast";
import { GenerationConfig } from "@/components/features/playground-v2/types";
import { Generation } from "@/types/database";
import { IMultiValueInput } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { usePostPlayground } from "@/hooks/features/playground/use-post-playground";
import { toUnifiedConfigFromLegacy } from "@/lib/adapters/data-mapping";

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
        const resp = await fetch('/api/save-image', {
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
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
        } catch (err) {
            console.error('Failed to save history:', err);
            toast({ title: "保存历史失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
        }
    };

    const handleGenerate = async (configOverride?: GenerationConfig, fixedCreatedAt?: string, isBackground?: boolean) => {
        const generationTime = fixedCreatedAt || new Date().toISOString();
        const freshConfig = usePlaygroundStore.getState().config;
        const currentLoras = usePlaygroundStore.getState().selectedLoras;
        const finalConfig = {
            ...(configOverride && typeof configOverride === 'object' && 'prompt' in configOverride
                ? configOverride
                : freshConfig),
            loras: currentLoras,
            presetName: selectedPresetName
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
            userId: 'anonymous',
            projectId: projectStore.currentProjectId || 'default',
            outputUrl: "",
            config: unifiedCfg,
            status: 'pending',
            sourceImageUrl: sourceImageUrl,
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
                    userId: 'anonymous',
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

            if (selectedModel === "Workflow") {
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
    };

    const handleUnifiedImageGen = async (taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrl?: string) => {
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;

        let modelId = "lemo_2dillustator"; // Default
        if (selectedModel === "Nano banana") modelId = "gemini-1.5-flash";
        if (selectedModel === "Seed 4.0") modelId = "seed4_lemo1230";
        if (selectedModel === "Seed 4.2") modelId = "seed4_2_lemo";
        if (selectedModel === "Seed 4") modelId = "lemoseedt2i";

        const unified = toUnifiedConfigFromLegacy(currentConfig);

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

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            batchSize: 1, // Single task per call now
            image: currentUploadedImages.length > 0 ? currentUploadedImages[0].base64 : undefined,
            options: {
                seed: Math.floor(Math.random() * 2147483647)
            }
        });

        if (res?.images && res.images.length > 0) {
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
                    sourceImageUrl: currentUploadedImages.length > 0 ? currentUploadedImages[0].base64 : undefined,
                }
            );
            const gen: Generation = {
                id: taskId,
                userId: 'anonymous',
                projectId: projectStore.currentProjectId || 'default',
                outputUrl: savedPath,
                config: unified,
                status: 'completed',
                sourceImageUrl: sourceImageUrl, // 使用一开始获取的 sourceImageUrl
                createdAt: generationTime,
            };
            updateHistoryAndSave(taskId, gen);
        } else {
            throw new Error(`${selectedModel} returned empty result`);
        }
    };

    const handleWorkflow = async (taskId: string, currentConfig: GenerationConfig, generationTime: string, sourceImageUrl?: string) => {
        if (!selectedWorkflowConfig) throw new Error("未选择工作流");

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
                            sourceImageUrl: sourceImageUrl,
                        }
                    );
                    const gen: Generation = {
                        id: taskId,
                        userId: 'anonymous',
                        projectId: projectStore.currentProjectId || 'default',
                        outputUrl: savedPath,
                        config: {
                            ...unified,
                            loras: usePlaygroundStore.getState().selectedLoras,
                            workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                        },
                        status: 'completed',
                        sourceImageUrl: sourceImageUrl,
                        createdAt: generationTime,
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
