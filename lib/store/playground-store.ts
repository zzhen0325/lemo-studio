import { create } from 'zustand';
import { GenerationConfig, UploadedImage, Preset, GenerationResult, StyleStack } from '@/components/features/playground-v2/types';
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { SelectedLora } from '@/components/features/playground-v2/LoraSelectorDialog';

interface PlaygroundState {
    config: GenerationConfig;
    uploadedImages: UploadedImage[];
    describeImages: UploadedImage[];
    selectedModel: string;
    selectedWorkflowConfig: IViewComfy | undefined;
    selectedLoras: SelectedLora[];
    hasGenerated: boolean;
    showHistory: boolean;

    // Actions
    updateConfig: (config: Partial<GenerationConfig>) => void;
    setUploadedImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
    setDescribeImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
    setSelectedModel: (model: string) => void;
    setSelectedWorkflowConfig: (workflow: IViewComfy | undefined) => void;
    setSelectedLoras: (loras: SelectedLora[]) => void;
    setHasGenerated: (val: boolean) => void;
    setShowHistory: (val: boolean) => void;
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
    remix: (result: { config: GenerationConfig, workflow?: IViewComfy, loras?: SelectedLora[] }) => void;
    resetState: () => void;

    // Generation History
    generationHistory: GenerationResult[];
    setGenerationHistory: (history: GenerationResult[] | ((prev: GenerationResult[]) => GenerationResult[])) => void;
    fetchHistory: () => Promise<void>;

    // Presets
    presets: Preset[];
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
}

export const usePlaygroundStore = create<PlaygroundState>()((set) => ({
    config: {
        prompt: '',
        img_width: 1376,
        img_height: 768,
        gen_num: 1,
        base_model: 'Nano banana',
        image_size: '1K',
        lora: ''
    },
    uploadedImages: [],
    describeImages: [],
    selectedModel: 'Nano banana',
    selectedWorkflowConfig: undefined,
    selectedLoras: [],
    hasGenerated: false,
    showHistory: false,
    isAspectRatioLocked: false,
    setAspectRatioLocked: (locked) => set({ isAspectRatioLocked: locked }),
    isMockMode: false,
    setMockMode: (mode) => set({ isMockMode: mode }),
    isSelectorExpanded: false,
    setSelectorExpanded: (expanded) => set({ isSelectorExpanded: expanded }),

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

            set((state) => ({
                uploadedImages: [...state.uploadedImages, {
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
            const newConfig = configData ? { ...state.config, ...configData, base_model: model } : { ...state.config, base_model: model };
            return {
                selectedModel: model,
                config: newConfig,
                selectedWorkflowConfig: model === 'Workflow' ? state.selectedWorkflowConfig : undefined
            };
        });
    },

    remix: (result) => {
        set((state) => {
            const finalModel = result.config.base_model || state.selectedModel;
            return {
                selectedModel: finalModel,
                selectedWorkflowConfig: result.workflow || (finalModel === 'Workflow' ? state.selectedWorkflowConfig : undefined),
                selectedLoras: result.loras || state.selectedLoras,
                config: { ...state.config, ...result.config, base_model: finalModel },
                hasGenerated: true
            };
        });
    },

    resetState: () => {
        set({
            config: {
                prompt: '',
                img_width: 1376,
                img_height: 768,
                gen_num: 1,
                base_model: 'Nano banana',
                image_size: '1K',
                lora: ''
            },
            uploadedImages: [],
            describeImages: [],
            selectedModel: 'Nano banana',
            selectedWorkflowConfig: undefined,
            selectedLoras: [],
            hasGenerated: false,
            showHistory: false,
            isAspectRatioLocked: false,
            isMockMode: false,
            isSelectorExpanded: false
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
                    set({ generationHistory: data.history });
                }
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
        }
    },

    presets: [],
    initPresets: async () => {
        try {
            const res = await fetch('/api/presets');
            if (res.ok) {
                const data = await res.json();
                set({ presets: data });
            }
        } catch (e) {
            console.error("Error fetching presets:", e);
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
