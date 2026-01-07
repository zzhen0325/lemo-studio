"use client";

import { usePlaygroundStore } from "@/lib/store/playground-store";
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

    const handleGenerate = async (configOverride?: GenerationConfig) => {
        const freshConfig = usePlaygroundStore.getState().config;
        const finalConfig = configOverride && typeof configOverride === 'object' && 'prompt' in configOverride
            ? configOverride
            : freshConfig;

        if (!finalConfig.prompt?.trim()) {
            toast({ title: "错误", description: "请输入图像描述文本", variant: "destructive" });
            return;
        }

        // Set state to indicate generation has started
        setHasGenerated(true);
        const taskId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

        const unifiedCfg = toUnifiedConfigFromLegacy({
            prompt: finalConfig.prompt,
            img_width: Number(finalConfig.img_width),
            img_height: Number(finalConfig.img_height),
            base_model: finalConfig.base_model || selectedModel,
            image_size: finalConfig.image_size,
            lora: finalConfig.lora,
        });
        const loadingGen: Generation = {
            id: taskId,
            userId: 'anonymous',
            projectId: 'default',
            outputUrl: "",
            config: {
                prompt: unifiedCfg.prompt,
                width: unifiedCfg.width,
                height: unifiedCfg.height,
                model: unifiedCfg.model,
                lora: unifiedCfg.lora,
            },
            status: 'pending',
            sourceImageUrl: undefined,
            createdAt: new Date().toISOString(),
        };

        // Use standard state update for history
        setGenerationHistory((prev: Generation[]) => [loadingGen, ...prev]);

        try {
            if (isMockMode) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                const result: Generation = {
                    id: taskId,
                    userId: 'anonymous',
                    projectId: 'default',
                    outputUrl: mockImageUrl,
                    config: {
                        prompt: unifiedCfg.prompt,
                        width: unifiedCfg.width,
                        height: unifiedCfg.height,
                        model: unifiedCfg.model,
                        lora: unifiedCfg.lora,
                    },
                    status: 'completed',
                    sourceImageUrl: undefined,
                    createdAt: new Date().toISOString(),
                };
                updateHistoryAndSave(taskId, result);
                return;
            }

            if (selectedModel === "Workflow") {
                await handleWorkflow(taskId, finalConfig);
            } else {
                await handleUnifiedImageGen(taskId, finalConfig);
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
        setGenerationHistory((prev: Generation[]) => prev.map(item => item.id === taskId ? result : item));
        saveHistoryToBackend(result);
    };

    const handleUnifiedImageGen = async (taskId: string, currentConfig: GenerationConfig) => {
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;

        let modelId = "lemo_2dillustator"; // Default
        if (selectedModel === "Nano banana") modelId = "gemini-1.5-flash";
        if (selectedModel === "Seed 4.0") modelId = "seed4_lemo1230";

        const unified = toUnifiedConfigFromLegacy({
            prompt: currentConfig.prompt,
            img_width: Number(currentConfig.img_width),
            img_height: Number(currentConfig.img_height),
            base_model: selectedModel || currentConfig.base_model,
            image_size: currentConfig.image_size,
            lora: currentConfig.lora,
        });

        const res = await callImage({
            model: modelId,
            prompt: unified.prompt,
            width: Number(unified.width),
            height: Number(unified.height),
            batchSize: currentConfig.gen_num || 1,
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
                    },
                    createdAt: new Date().toISOString(),
                    sourceImageUrl: currentUploadedImages.length > 0 ? currentUploadedImages[0].base64 : undefined,
                }
            );
            const gen: Generation = {
                id: taskId,
                userId: 'anonymous',
                projectId: 'default',
                outputUrl: savedPath,
                config: {
                    prompt: unified.prompt,
                    width: Number(unified.width),
                    height: Number(unified.height),
                    model: unified.model || selectedModel,
                    workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                    lora: unified.lora,
                },
                status: 'completed',
                sourceImageUrl: currentUploadedImages.length > 0 ? currentUploadedImages[0].base64 : undefined,
                createdAt: new Date().toISOString(),
            };
            updateHistoryAndSave(taskId, gen);
        } else {
            throw new Error(`${selectedModel} returned empty result`);
        }
    };

    const handleWorkflow = async (taskId: string, currentConfig: GenerationConfig) => {
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
                else if (pName === 'width') paramMap.set(pathKey, currentConfig.img_width);
                else if (pName === 'height') paramMap.set(pathKey, currentConfig.img_height);
                else if (pName === 'batch_size') paramMap.set(pathKey, currentConfig.gen_num);
            });
            mappedInputs = allInputs.map(item => ({ key: item.key, value: paramMap.has(item.key) ? paramMap.get(item.key) : item.value }));
        } else {
            mappedInputs = allInputs.map(item => {
                const title = item.title || "";
                if (/prompt|文本|提示/i.test(title)) return { key: item.key, value: currentConfig.prompt };
                if (/width/i.test(title)) return { key: item.key, value: currentConfig.img_width };
                if (/height/i.test(title)) return { key: item.key, value: currentConfig.img_height };
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
        const formatLoras = () => {
            const loras = usePlaygroundStore.getState().selectedLoras || [];
            if (!loras.length) return undefined;
            return loras.map(l => `${l.model_name}@${typeof l.strength === 'number' ? l.strength.toFixed(2) : l.strength}`).join(',');
        };

        await runComfyWorkflow({
            viewComfy: { inputs: mappedInputs, textOutputEnabled: false },
            workflow: selectedWorkflowConfig.workflowApiJSON || undefined,
            viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint || null,
            onSuccess: async (outputs) => {
                if (outputs.length > 0) {
                    const dataUrl = await blobToDataURL(outputs[0]);
                    const unified = toUnifiedConfigFromLegacy({
                        prompt: currentConfig.prompt,
                        img_width: Number(currentConfig.img_width),
                        img_height: Number(currentConfig.img_height),
                        base_model: extractModelFromMapping(),
                        image_size: currentConfig.image_size,
                        lora: currentConfig.lora,
                    });
                    const savedPath = await saveImageToOutputs(
                        dataUrl,
                        {
                            config: {
                                prompt: unified.prompt,
                                width: Number(unified.width),
                                height: Number(unified.height),
                                model: unified.model,
                                lora: formatLoras() ?? unified.lora,
                            },
                            createdAt: new Date().toISOString(),
                            sourceImageUrl: undefined,
                        }
                    );
            const gen: Generation = {
                id: taskId,
                userId: 'anonymous',
                projectId: 'default',
                outputUrl: savedPath,
                config: {
                    prompt: unified.prompt,
                    width: Number(unified.width),
                    height: Number(unified.height),
                    model: unified.model,
                    workflowName: usePlaygroundStore.getState().selectedWorkflowConfig?.viewComfyJSON?.title || undefined,
                    lora: formatLoras() ?? unified.lora,
                },
                status: 'completed',
                sourceImageUrl: undefined,
                createdAt: new Date().toISOString(),
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
        isGenerating: isAIProcessing || isWorkflowProcessing
    };
}
