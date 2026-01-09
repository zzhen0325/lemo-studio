import { create } from 'zustand';
import { GenerationConfig, UploadedImage, Preset, StyleStack } from '@/components/features/playground-v2/types';
import { Generation } from '@/types/database';
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { SelectedLora } from '@/components/features/playground-v2/Dialogs/LoraSelectorDialog';

const BASE_MODELS = new Set([
    'FLUX_fill',
    'flux1-dev-fp8.safetensors',
    'Zimage',
    'qwen'
]);

interface PlaygroundState {
    config: GenerationConfig;
    uploadedImages: UploadedImage[];
    describeImages: UploadedImage[];
    selectedModel: string;
    selectedWorkflowConfig: IViewComfy | undefined;
    selectedLoras: SelectedLora[];
    hasGenerated: boolean;
    showHistory: boolean;
    showGallery: boolean;
    showProjectSidebar: boolean;
    selectedPresetName: string | undefined;

    // Selection Mode
    isSelectionMode: boolean;
    selectedHistoryIds: Set<string>;
    setIsSelectionMode: (val: boolean) => void;
    toggleHistorySelection: (id: string) => void;
    setHistorySelection: (ids: string[]) => void;
    clearHistorySelection: () => void;

    // Actions
    updateConfig: (config: Partial<GenerationConfig>) => void;
    setUploadedImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
    setDescribeImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
    setSelectedModel: (model: string) => void;
    setSelectedWorkflowConfig: (workflow: IViewComfy | undefined) => void;
    setSelectedLoras: (loras: SelectedLora[]) => void;
    setHasGenerated: (val: boolean) => void;
    setShowHistory: (val: boolean) => void;
    setShowGallery: (val: boolean) => void;
    setShowProjectSidebar: (val: boolean) => void;
    setSelectedPresetName: (name: string | undefined) => void;
    setActiveTab: (tab: string) => void;

    // UI States
    isAspectRatioLocked: boolean;
    setAspectRatioLocked: (locked: boolean) => void;
    isMockMode: boolean;
    setMockMode: (mode: boolean) => void;
    isSelectorExpanded: boolean;
    setSelectorExpanded: (expanded: boolean) => void;

    // High-level Actions
    applyPrompt: (prompt: string) => void;
    applyImage: (imageUrl: string) => Promise<void>;
    applyModel: (model: string, configData?: GenerationConfig) => void;
    remix: (result: Generation) => void;
    resetState: () => void;

    // Generation History
    generationHistory: Generation[];
    setGenerationHistory: (history: Generation[] | ((prev: Generation[]) => Generation[])) => void;
    fetchHistory: () => Promise<void>;

    // Presets
    presets: (Preset & { workflow_id?: string })[];
    initPresets: () => void;
    addPreset: (preset: Preset, coverFile?: File) => void;
    removePreset: (id: string) => void;
    updatePreset: (preset: Preset, coverFile?: File) => void;

    // Style Stacks
    styles: StyleStack[];
    initStyles: () => void;
    addStyle: (style: StyleStack) => void;
    updateStyle: (style: StyleStack) => void;
    deleteStyle: (id: string) => void;
    addImageToStyle: (styleId: string, imagePath: string) => void;

    // Global Preview State
    previewImageUrl: string | null;
    previewLayoutId: string | null;
    setPreviewImage: (url: string | null, layoutId?: string | null) => void;
}

export const usePlaygroundStore = create<PlaygroundState>()((set) => ({
    config: {
        prompt: '',
        width: 1376,
        height: 768,
        model: 'Nano banana',
        resolution: '1K',
        lora: ''
    },
    uploadedImages: [],
    describeImages: [],
    selectedModel: 'Nano banana',
    selectedWorkflowConfig: undefined,
    selectedLoras: [],
    hasGenerated: false,
    showHistory: false,
    showGallery: false,
    showProjectSidebar: false,
    isSelectionMode: false,
    selectedHistoryIds: new Set(),
    setIsSelectionMode: (val) => set({ isSelectionMode: val, selectedHistoryIds: val ? new Set() : new Set() }),
    toggleHistorySelection: (id) => set((state) => {
        const newSet = new Set(state.selectedHistoryIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return { selectedHistoryIds: newSet };
    }),
    setHistorySelection: (ids) => set({ selectedHistoryIds: new Set(ids) }),
    clearHistorySelection: () => set({ selectedHistoryIds: new Set() }),
    isAspectRatioLocked: false,
    setAspectRatioLocked: (locked) => set({ isAspectRatioLocked: locked }),
    isMockMode: false,
    setMockMode: (mode) => set({ isMockMode: mode }),
    isSelectorExpanded: false,
    setSelectorExpanded: (expanded) => set({ isSelectorExpanded: expanded }),
    selectedPresetName: undefined,
    setSelectedPresetName: (name) => set({ selectedPresetName: name }),

    previewImageUrl: null,
    previewLayoutId: null,
    setPreviewImage: (url, layoutId = null) => set({
        previewImageUrl: url,
        previewLayoutId: layoutId
    }),

    updateConfig: (newConfig) => set((state) => ({
        config: { ...state.config, ...newConfig }
    })),

    setUploadedImages: (updater) => set((state) => ({
        uploadedImages: typeof updater === 'function' ? updater(state.uploadedImages) : updater
    })),
    setDescribeImages: (updater) => set((state) => ({
        describeImages: typeof updater === 'function' ? updater(state.describeImages) : updater
    })),

    setSelectedModel: (model) => set({ selectedModel: model }),
    setSelectedWorkflowConfig: (workflow) => set({ selectedWorkflowConfig: workflow }),
    setSelectedLoras: (loras) => set({ selectedLoras: loras }),
    setHasGenerated: (val) => set({ hasGenerated: val }),
    setShowHistory: (val) => set({ showHistory: val }),
    setShowGallery: (val) => set({ showGallery: val }),
    setShowProjectSidebar: (val) => set({ showProjectSidebar: val }),
    setActiveTab: () => {
        // Placeholder
    },

    applyPrompt: (prompt) => {
        set((state) => ({ config: { ...state.config, prompt } }));
    },

    applyImage: async (imageUrl) => {
        try {
            const resp = await fetch(imageUrl);
            const blob = await resp.blob();
            const file = new File([blob], `image-${Date.now()}.png`, { type: 'image/png' });
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve) => {
                reader.onload = (e) => resolve(String(e.target?.result));
                reader.readAsDataURL(blob);
            });
            const base64Data = dataUrl.split(',')[1];

            set(() => ({
                uploadedImages: [{
                    file,
                    base64: base64Data,
                    previewUrl: dataUrl
                }]
            }));
        } catch (error) {
            console.error("Failed to apply image", error);
        }
    },

    applyModel: (model, configData) => {
        set((state) => {
            const finalModel = model;
            let uiModel = model;
            if (BASE_MODELS.has(model)) {
                uiModel = 'Workflow';
            }

            let newConfig = configData ? { ...state.config, ...configData, model: finalModel } : { ...state.config, model: finalModel };
            
            // Default to 2K for Seed 4.2
            if (finalModel === 'Seed 4.2' && !newConfig.resolution) {
                newConfig.resolution = '2K';
            }

            return {
                selectedModel: uiModel,
                config: newConfig,
                selectedWorkflowConfig: uiModel === 'Workflow' ? state.selectedWorkflowConfig : undefined,
                // If configData explicitly provides loras array, use it as priority
                selectedLoras: configData?.loras || state.config?.loras || state.selectedLoras,
                selectedPresetName: configData?.presetName || state.selectedPresetName
            };
        });
    },

    remix: (result: Generation) => {
        set((state) => {
            const modelFromConfig = result.config?.model;
            const finalModel = (modelFromConfig as string) || state.selectedModel;
            let uiModel = finalModel;

            if (BASE_MODELS.has(finalModel)) {
                uiModel = 'Workflow';
            }

            return {
                selectedModel: uiModel,
                selectedWorkflowConfig: result.config?.workflowName ? (state.presets.find(p => p.workflow_id === result.id || p.name === result.config.workflowName) as unknown as IViewComfy) : (uiModel === 'Workflow' ? state.selectedWorkflowConfig : undefined),
                selectedLoras: result.config?.loras || state.selectedLoras,
                selectedPresetName: result.config?.presetName || state.selectedPresetName,
                config: {
                    ...state.config,
                    prompt: result.config?.prompt || state.config.prompt,
                    width: result.config?.width || state.config.width,
                    height: result.config?.height || state.config.height,
                    model: finalModel,
                    workflowName: result.config?.workflowName,
                    loras: result.config?.loras || state.config.loras,
                    seed: result.config?.seed,
                    resolution: result.config?.resolution,
                    aspectRatio: result.config?.aspectRatio,
                    sizeFrom: result.config?.sizeFrom
                },
                hasGenerated: true
            };
        });
    },

    resetState: () => {
        set({
            config: {
                prompt: '',
                width: 1376,
                height: 768,
                model: 'Nano banana',
                resolution: '1K',
                lora: ''
            },
            uploadedImages: [],
            describeImages: [],
            selectedModel: 'Nano banana',
            selectedWorkflowConfig: undefined,
            selectedLoras: [],
            hasGenerated: false,
            showHistory: false,
            showGallery: false,
            showProjectSidebar: false,
            isAspectRatioLocked: false,
            isMockMode: false,
            isSelectorExpanded: false,
            selectedPresetName: undefined,
            isSelectionMode: false,
            selectedHistoryIds: new Set()
        });
    },

    generationHistory: [],
    setGenerationHistory: (updater) => set((state) => ({
        generationHistory: typeof updater === 'function' ? updater(state.generationHistory) : updater
    })),

    fetchHistory: async () => {
        try {
            const res = await fetch('/api/history');
            if (res.ok) {
                const data = await res.json();
                if (data.history) {
                    set({ generationHistory: data.history as Generation[] });
                }
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    },

    presets: [],
    initPresets: async () => {
        try {
            const [presetsRes, workflowsRes] = await Promise.all([
                fetch('/api/presets'),
                fetch('/api/view-comfy')
            ]);

            let allPresets: Preset[] = [];

            if (presetsRes.ok) {
                const presetsData = await presetsRes.json();
                allPresets = [...presetsData];
            }

            if (workflowsRes.ok) {
                const workflowsData = await workflowsRes.json();
                const workflowPresets: Preset[] = (workflowsData.viewComfys || []).map((wf: IViewComfy) => ({
                    id: wf.viewComfyJSON.id || `wf_${Date.now()}_${Math.random()}`,
                    name: wf.viewComfyJSON.title || "Untitled Workflow",
                    coverUrl: wf.viewComfyJSON.previewImages?.[0] || "",
                    category: 'Workflow',
                    workflow_id: wf.viewComfyJSON.id, // Explicitly add this for handlePresetSelect
                    config: {
                        prompt: "",
                        width: 1024,
                        height: 1024,
                        model: (() => {
                            // 尝试从映射配置中提取
                            const components = (wf.viewComfyJSON.mappingConfig?.components || []) as { properties?: { paramName?: string; defaultValue?: string }; mapping?: { workflowPath?: string[] } }[];
                            const modelComp = components.find(c =>
                                c.properties?.paramName === 'base_model' ||
                                c.properties?.paramName === 'model'
                            );

                            if (modelComp) {
                                const path = modelComp.mapping?.workflowPath;
                                if (path && path.length >= 3 && wf.workflowApiJSON) {
                                    const [nodeId, , key] = path;
                                    const val = (wf.workflowApiJSON as Record<string, { inputs?: Record<string, string | number | boolean> }>)[nodeId]?.inputs?.[key];
                                    if (typeof val === 'string') return val;
                                }
                                if (modelComp.properties?.defaultValue) return modelComp.properties.defaultValue;
                            }

                            // 备选：从旧版 inputs 提取
                            const allInputs = [
                                ...(wf.viewComfyJSON.inputs || []),
                                ...(wf.viewComfyJSON.advancedInputs || [])
                            ].flatMap((group) => group.inputs || []);

                            const inputModel = allInputs.find((i) => {
                                const title = (i.title || "").toLowerCase();
                                return title.includes("model") || title.includes("模型");
                            });

                            if (inputModel && typeof inputModel.value === 'string') return inputModel.value;

                            return 'Workflow';
                        })(),
                        workflowName: wf.viewComfyJSON.title
                    },
                    createdAt: new Date().toISOString()
                }));
                allPresets = [...allPresets, ...workflowPresets];
            }

            set({ presets: allPresets });
        } catch (e) {
            console.error("Error fetching presets and workflows:", e);
        }
    },

    addPreset: async (preset: Preset, coverFile?: File) => {
        try {
            const formData = new FormData();
            formData.append('json', JSON.stringify(preset));
            if (coverFile) formData.append('cover', coverFile);
            const res = await fetch('/api/presets', { method: 'POST', body: formData });
            if (res.ok) {
                const savedPreset = await res.json();
                set((state) => ({ presets: [savedPreset, ...state.presets] }));
            }
        } catch (e) {
            console.error("Failed to add preset", e);
        }
    },

    removePreset: async (id: string) => {
        try {
            await fetch(`/api/presets?id=${id}`, { method: 'DELETE' });
            set((state) => ({ presets: state.presets.filter(p => p.id !== id) }));
        } catch (e) {
            console.error("Failed to delete preset", e);
        }
    },

    updatePreset: async (preset: Preset, coverFile?: File) => {
        try {
            const formData = new FormData();
            formData.append('json', JSON.stringify(preset));
            if (coverFile) formData.append('cover', coverFile);
            const res = await fetch('/api/presets', { method: 'POST', body: formData });
            if (res.ok) {
                const savedPreset = await res.json();
                set((state) => ({
                    presets: state.presets.map(p => p.id === savedPreset.id ? savedPreset : p)
                }));
            }
        } catch (e) {
            console.error("Failed to update preset", e);
        }
    },

    // Style Stacks
    styles: [],

    initStyles: async () => {
        try {
            const res = await fetch('/api/styles');
            if (res.ok) {
                const data = await res.json();
                set({ styles: data });
            }
        } catch (e) {
            console.error("Error fetching styles:", e);
        }
    },

    addStyle: async (style: StyleStack) => {
        try {
            const res = await fetch('/api/styles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(style)
            });
            if (res.ok) {
                const savedStyle = await res.json();
                set((state) => ({ styles: [savedStyle, ...state.styles] }));
            }
        } catch (e) {
            console.error("Failed to add style", e);
        }
    },

    updateStyle: async (style: StyleStack) => {
        try {
            const res = await fetch('/api/styles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(style)
            });
            if (res.ok) {
                const savedStyle = await res.json();
                set((state) => ({
                    styles: state.styles.map(s => s.id === savedStyle.id ? savedStyle : s)
                }));
            }
        } catch (e) {
            console.error("Failed to update style", e);
        }
    },

    deleteStyle: async (id: string) => {
        try {
            await fetch(`/api/styles?id=${id}`, { method: 'DELETE' });
            set((state) => ({ styles: state.styles.filter(s => s.id !== id) }));
        } catch (e) {
            console.error("Failed to delete style", e);
        }
    },

    addImageToStyle: async (styleId: string, imagePath: string) => {
        set((state) => {
            const style = state.styles.find(s => s.id === styleId);
            if (!style) return state;
            if (style.imagePaths.includes(imagePath)) return state;
            const updatedStyle = {
                ...style,
                imagePaths: [...style.imagePaths, imagePath],
                updatedAt: new Date().toISOString()
            };
            const newStyles = state.styles.map(s => s.id === styleId ? updatedStyle : s);
            fetch('/api/styles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedStyle)
            }).catch(e => console.error("Failed to sync style image addition", e));
            return { styles: newStyles };
        });
    },
}));
