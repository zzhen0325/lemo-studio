"use client";

import { useTransition } from "react";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useAIService } from "@/hooks/ai/useAIService";
import { useToast } from "@/hooks/common/use-toast";
import { GenerationConfig, GenerationResult } from "@/components/features/playground-v2/types";
import { IMultiValueInput } from "@/lib/workflow-api-parser";
import { UIComponent } from "@/types/features/mapping-editor";
import { usePostPlayground } from "@/hooks/features/playground/use-post-playground";

export function useGenerationService() {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const selectedModel = usePlaygroundStore(s => s.selectedModel);
    const selectedWorkflowConfig = usePlaygroundStore(s => s.selectedWorkflowConfig);
    const isMockMode = usePlaygroundStore(s => s.isMockMode);
    const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
    const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);

    const { callImage, isLoading: isAIProcessing } = useAIService();
    const { doPost: runComfyWorkflow } = usePostPlayground();

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
    const saveHistoryToBackend = async (item: GenerationResult) => {
        try {
            const historyItem = {
                imageUrl: item.savedPath || item.imageUrl || '',
                timestamp: item.timestamp || new Date().toISOString(),
                metadata: {
                    prompt: item.prompt || item.config?.prompt || '',
                    base_model: item.config?.base_model || '',
                    img_width: item.config?.img_width || 1024,
                    img_height: item.config?.img_height || 1024,
                    lora: item.config?.lora || ''
                },
                type: item.type || 'image',
                sourceImage: item.sourceImage,
                projectId: item.projectId || 'default'
            };
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(historyItem),
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

        startTransition(async () => {
            setHasGenerated(true);
            const taskId = Date.now().toString() + Math.random().toString(36).substring(2, 7);

            const loadingResult: GenerationResult = {
                id: taskId,
                imageUrl: "",
                prompt: finalConfig.prompt,
                config: { ...finalConfig, base_model: finalConfig.base_model || selectedModel },
                timestamp: new Date().toISOString(),
                isLoading: true
            };

            setGenerationHistory(prev => [loadingResult, ...prev]);

            try {
                if (isMockMode) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const mockImageUrl = `/uploads/1750263630880_smwzxy6h4ws.png`;
                    const result: GenerationResult = {
                        id: taskId,
                        imageUrl: mockImageUrl,
                        savedPath: mockImageUrl,
                        prompt: finalConfig.prompt,
                        config: { ...finalConfig },
                        timestamp: new Date().toISOString(),
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
                setGenerationHistory(prev => prev.filter(item => item.id !== taskId));
                toast({ title: "生成失败", description: err instanceof Error ? err.message : "未知错误", variant: "destructive" });
            }
        });
    };

    const updateHistoryAndSave = (taskId: string, result: GenerationResult) => {
        setGenerationHistory(prev => prev.map(item => item.id === taskId ? result : item));
        saveHistoryToBackend(result);
    };

    const handleUnifiedImageGen = async (taskId: string, currentConfig: GenerationConfig) => {
        const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;

        let modelId = "lemo_2dillustator"; // Default
        if (selectedModel === "Nano banana") modelId = "gemini-1.5-flash";
        if (selectedModel === "Seed 4.0") modelId = "seed4_lemo1230";

        const res = await callImage({
            model: modelId,
            prompt: currentConfig.prompt,
            width: Number(currentConfig.img_width),
            height: Number(currentConfig.img_height),
            batchSize: currentConfig.gen_num || 1,
            image: currentUploadedImages.length > 0 ? currentUploadedImages[0].base64 : undefined,
            options: {
                seed: Math.floor(Math.random() * 2147483647)
            }
        });

        if (res?.images && res.images.length > 0) {
            const dataUrl = res.images[0];
            const savedPath = await saveImageToOutputs(dataUrl, { ...currentConfig, base_model: selectedModel });
            updateHistoryAndSave(taskId, { id: taskId, imageUrl: dataUrl, savedPath, prompt: currentConfig.prompt, config: { ...currentConfig }, timestamp: new Date().toISOString() });
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
                if (/height/i.test(title)) return { key: item.key, value: currentConfig.image_height };
                return { key: item.key, value: item.value };
            });
        }

        await runComfyWorkflow({
            viewComfy: { inputs: mappedInputs, textOutputEnabled: false },
            workflow: selectedWorkflowConfig.workflowApiJSON || undefined,
            viewcomfyEndpoint: selectedWorkflowConfig.viewComfyJSON.viewcomfyEndpoint || null,
            onSuccess: async (outputs) => {
                if (outputs.length > 0) {
                    const dataUrl = await blobToDataURL(outputs[0]);
                    const savedPath = await saveImageToOutputs(dataUrl, { ...currentConfig, base_model: "Workflow" });
                    updateHistoryAndSave(taskId, { id: taskId, imageUrl: dataUrl, savedPath, prompt: currentConfig.prompt, config: { ...currentConfig }, timestamp: new Date().toISOString() });
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
        isGenerating: isPending || isAIProcessing
    };
}
