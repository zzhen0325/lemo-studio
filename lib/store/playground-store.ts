import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UploadedImage, Preset, StyleStack } from '@/components/features/playground-v2/types';
import { Generation, GenerationConfig } from '@/types/database';
import { IViewComfy } from '@/lib/providers/view-comfy-provider';
import { SelectedLora } from '@/components/features/playground-v2/Dialogs/LoraSelectorDialog';
import { userStore } from './user-store';
import { getApiBase } from "@/lib/api-base";

import { MODEL_ID_WORKFLOW } from '../constants/models';
import { isWorkflowModel } from '../utils/model-utils';

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
    viewMode: 'home' | 'dock';
    activeTab: 'history' | 'gallery' | 'describe' | 'style';
    editConfig?: import('@/types/database').EditPresetConfig;

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
    setSelectedWorkflowConfig: (workflow: IViewComfy | undefined, presetName?: string) => void;
    setSelectedLoras: (loras: SelectedLora[]) => void;
    setHasGenerated: (val: boolean) => void;
    setShowHistory: (val: boolean) => void;
    setShowGallery: (val: boolean) => void;
    setShowProjectSidebar: (val: boolean) => void;
    setSelectedPresetName: (name: string | undefined) => void;
    setViewMode: (mode: 'home' | 'dock') => void;
    setActiveTab: (tab: 'history' | 'gallery' | 'describe' | 'style') => void;
    updateUploadedImage: (id: string, updates: Partial<UploadedImage>) => void;
    updateDescribeImage: (id: string, updates: Partial<UploadedImage>) => void;
    updateHistorySourceUrl: (oldUrl: string, newUrl: string) => void;
    syncLocalImageToHistory: (localId: string, serverPath: string) => Promise<void>;

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
    applyImages: (imageUrls: string[]) => Promise<void>;
    applyModel: (model: string, configData?: GenerationConfig) => void;
    remix: (result: Generation) => void;
    resetState: () => void;

    // Generation History
    generationHistory: Generation[];
    setGenerationHistory: (history: Generation[] | ((prev: Generation[]) => Generation[])) => void;
    fetchHistory: (page?: number, projectId?: string) => Promise<void>;
    historyPage: number;
    hasMoreHistory: boolean;
    isFetchingHistory: boolean;

    // Presets
    presets: (Preset & { workflow_id?: string })[];
    initPresets: () => void;
    addPreset: (preset: Preset, coverFile?: File) => void;
    removePreset: (id: string) => void;
    updatePreset: (preset: Preset, coverFile?: File) => void;

    // Style Stacks
    styles: StyleStack[];
    initStyles: () => void;
    addStyle: (style: StyleStack) => Promise<void>;
    updateStyle: (style: StyleStack) => void;
    deleteStyle: (id: string) => Promise<void>;
    removeImageFromStyle: (styleId: string, imagePath: string) => Promise<void>;
    addImageToStyle: (styleId: string, imagePath: string) => Promise<void>;

    // Categories
    presetCategories: string[];
    initCategories: () => void;
    saveCategories: (categories: string[]) => Promise<void>;
    renameCategory: (oldName: string, newName: string) => Promise<void>;

    // Global Preview State
    previewImageUrl: string | null;
    previewLayoutId: string | null;
    setPreviewImage: (url: string | null, layoutId?: string | null) => void;

    // Gallery
    galleryItems: Generation[];
    galleryPage: number;
    hasMoreGallery: boolean;
    isFetchingGallery: boolean;
    fetchGallery: (page?: number) => Promise<void>;
    addGalleryItem: (item: Generation) => void;
    deleteHistory: (ids: string[]) => Promise<void>;
}

export const usePlaygroundStore = create<PlaygroundState>()(
    persist(
        (set, get) => ({
            config: {
                prompt: '',
                width: 1376,
                height: 768,
                model: 'gemini-3-pro-image-preview',
                imageSize: '1K',
                isEdit: false,
                parentId: undefined
            },
            uploadedImages: [],
            describeImages: [],
            selectedModel: 'gemini-3-pro-image-preview',
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
            viewMode: 'home',
            activeTab: 'history',
            setSelectedPresetName: (name) => set({ selectedPresetName: name }),
            setViewMode: (mode) => set((state) => ({
                viewMode: mode,
                // When going home, always show history/input
                activeTab: mode === 'home' ? 'history' : state.activeTab
            })),
            setActiveTab: (tab) => set({ activeTab: tab }),

            previewImageUrl: null,
            previewLayoutId: null,
            setPreviewImage: (url, layoutId = null) => set({
                previewImageUrl: url,
                previewLayoutId: layoutId
            }),

            updateConfig: (newConfig) => set((state) => ({
                config: { ...state.config, ...newConfig }
            })),

            setUploadedImages: (updater) => set((state) => {
                const newImages = typeof updater === 'function' ? updater(state.uploadedImages) : updater;

                // 如果图片被清空，重置编辑状态，防止残留参考图
                if (newImages.length === 0 && state.config.isEdit) {
                    return {
                        uploadedImages: newImages,
                        config: {
                            ...state.config,
                            isEdit: false,
                            editConfig: undefined,
                            parentId: undefined
                        }
                    };
                }

                return { uploadedImages: newImages };
            }),
            setDescribeImages: (updater) => set((state) => ({
                describeImages: typeof updater === 'function' ? updater(state.describeImages) : updater
            })),

            setSelectedModel: (model) => set({ selectedModel: model }),
            setSelectedWorkflowConfig: (workflow: IViewComfy | undefined, presetName?: string) => set((state) => ({
                selectedWorkflowConfig: workflow,
                selectedPresetName: presetName || state.selectedPresetName
            })),
            setSelectedLoras: (loras) => set({ selectedLoras: loras }),
            setHasGenerated: (val) => set({ hasGenerated: val }),
            setShowHistory: (val) => set({ showHistory: val }),
            setShowGallery: (val) => set({ showGallery: val }),
            setShowProjectSidebar: (val) => set({ showProjectSidebar: val }),

            updateUploadedImage: (id, updates) => set((state) => ({
                uploadedImages: state.uploadedImages.map(img => img.id === id ? { ...img, ...updates } : img)
            })),

            updateDescribeImage: (id, updates) => set((state) => ({
                describeImages: state.describeImages.map(img => img.id === id ? { ...img, ...updates } : img)
            })),

            updateHistorySourceUrl: (oldUrl, newUrl) => set((state) => ({
                generationHistory: state.generationHistory.map(item => {
                    let updated = false;
                    const newItem = { ...item };

                    // Update outputUrl
                    if (newItem.outputUrl === oldUrl) {
                        newItem.outputUrl = newUrl;
                        updated = true;
                    }

                    // Update top-level sourceImageUrls array
                    const itemAny = newItem as any;
                    if (itemAny.sourceImageUrls?.includes(oldUrl)) {
                        itemAny.sourceImageUrls = itemAny.sourceImageUrls.map((url: string) => url === oldUrl ? newUrl : url);
                        updated = true;
                    }

                    // Update config.sourceImageUrls array
                    if (newItem.config?.sourceImageUrls?.includes(oldUrl)) {
                        newItem.config = {
                            ...newItem.config,
                            sourceImageUrls: newItem.config.sourceImageUrls.map(url => url === oldUrl ? newUrl : url)
                        };
                        updated = true;
                    }

                    // Update editConfig.originalImageUrl
                    if (itemAny.editConfig?.originalImageUrl === oldUrl) {
                        itemAny.editConfig = { ...itemAny.editConfig, originalImageUrl: newUrl };
                        updated = true;
                    }
                    if (newItem.config?.editConfig?.originalImageUrl === oldUrl) {
                        newItem.config = {
                            ...newItem.config,
                            editConfig: { ...newItem.config.editConfig, originalImageUrl: newUrl }
                        };
                        updated = true;
                    }

                    return updated ? newItem : item;
                })
            })),

            syncLocalImageToHistory: async (localId, serverPath) => {
                // 1. Update local state - 只更新 config 内的字段
                set((state) => ({
                    generationHistory: state.generationHistory.map(item => {
                        const config = item.config;
                        if (!config) return item;

                        // Check localSourceIds array in config
                        if (config.localSourceIds?.includes(localId)) {
                            const idx = config.localSourceIds.indexOf(localId);
                            const sourceUrls = config.sourceImageUrls || [];
                            if (sourceUrls[idx] !== undefined) {
                                const newUrls = [...sourceUrls];
                                newUrls[idx] = serverPath;
                                return {
                                    ...item,
                                    config: {
                                        ...config,
                                        sourceImageUrls: newUrls
                                    }
                                };
                            }
                        }
                        return item;
                    })
                }));


                // 2. Sync to backend
                try {
                    await fetch(`${getApiBase()}/history`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'sync-image', localId, path: serverPath })
                    });
                } catch (e) {
                    console.error("Failed to sync image path to history backend", e);
                }
            },

            applyPrompt: (prompt) => {
                set((state) => ({ config: { ...state.config, prompt } }));
            },

            applyImage: async (imageUrl) => {
                const currentImages = get().uploadedImages;
                // Avoid duplicates
                if (currentImages.some(img => img.path === imageUrl)) {
                    return;
                }

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
                        uploadedImages: [
                            ...state.uploadedImages,
                            {
                                file,
                                base64: base64Data,
                                previewUrl: dataUrl,
                                path: imageUrl
                            }
                        ]
                    }));
                } catch (error) {
                    console.error("Failed to apply image", error);
                }
            },

            applyImages: async (imageUrls) => {
                try {
                    const newImages = await Promise.all(imageUrls.map(async (url) => {
                        const resp = await fetch(url);
                        const blob = await resp.blob();

                        const file = new File([blob], `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`, { type: 'image/png' });
                        const reader = new FileReader();
                        const dataUrl = await new Promise<string>((resolve) => {
                            reader.onload = (e) => resolve(String(e.target?.result));
                            reader.readAsDataURL(blob);
                        });
                        const base64Data = dataUrl.split(',')[1];
                        return {
                            file,
                            base64: base64Data,
                            previewUrl: dataUrl,
                            path: url
                        };
                    }));

                    set(() => ({ uploadedImages: newImages }));
                } catch (error) {
                    console.error("Failed to apply images", error);
                }
            },

            applyModel: (model, configData) => {
                set((state) => {
                    const finalModel = configData?.baseModel || model;
                    let uiModel = model;
                    if (isWorkflowModel(finalModel)) {
                        uiModel = MODEL_ID_WORKFLOW;
                    }

                    const newConfig = configData
                        ? { ...state.config, ...configData, model: finalModel, baseModel: finalModel, isPreset: !!(configData.presetName) }
                        : { ...state.config, model: finalModel, baseModel: finalModel, isPreset: false };

                    // Default to 2K for Seed 4.2
                    if (finalModel === 'seed4_2_lemo' && !newConfig.imageSize) {
                        newConfig.imageSize = '2K';
                    }

                    return {
                        selectedModel: uiModel,
                        config: newConfig,
                        selectedWorkflowConfig: uiModel === 'Workflow' ? state.selectedWorkflowConfig : undefined,
                        // If configData explicitly provides loras array, use it as priority
                        selectedLoras: configData?.loras || state.config?.loras || state.selectedLoras,
                        selectedPresetName: configData?.presetName || (configData ? undefined : state.selectedPresetName)
                    };
                });
            },

            remix: (result: Generation) => {
                set((state) => {
                    const modelFromConfig = result.config?.baseModel || result.config?.model;
                    const finalModel = (modelFromConfig as string) || state.selectedModel;
                    let uiModel = finalModel;

                    if (isWorkflowModel(finalModel)) {
                        uiModel = MODEL_ID_WORKFLOW;
                    }

                    return {
                        selectedModel: uiModel,
                        selectedWorkflowConfig: result.config?.presetName ? (state.presets.find(p => p.id === result.id || p.name === result.config.presetName) as unknown as IViewComfy) : (uiModel === MODEL_ID_WORKFLOW ? state.selectedWorkflowConfig : undefined),
                        selectedLoras: result.config?.loras || [],
                        selectedPresetName: result.config?.presetName,
                        config: {
                            ...state.config,
                            ...result.config, // 直接合并，因为后端已通过扩散操作补全了
                            model: finalModel,
                            baseModel: finalModel,
                            isPreset: result.config?.isPreset ?? !!(result.config?.presetName),
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
                        model: 'gemini-3-pro-image-preview',
                        imageSize: '2K',
                        aspectRatio: '16:9',
                        loras: [],
                        sourceImageUrls: [],
                        localSourceIds: [],
                        isPreset: false,
                        editConfig: undefined,
                        isEdit: false,
                        parentId: undefined
                    },
                    uploadedImages: [],
                    describeImages: [],
                    selectedModel: 'gemini-3-pro-image-preview',
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
                    viewMode: 'home',
                    activeTab: 'history',
                    editConfig: undefined,
                    isSelectionMode: false,
                    selectedHistoryIds: new Set(),
                    historyPage: 1,
                    hasMoreHistory: true,
                    isFetchingHistory: false
                });
            },

            generationHistory: [],
            historyPage: 1,
            hasMoreHistory: true,
            isFetchingHistory: false,
            setGenerationHistory: (updater) => set((state) => ({
                generationHistory: typeof updater === 'function' ? updater(state.generationHistory) : updater
            })),

            fetchHistory: async (page = 1, projectId) => {
                const state = get();
                if (state.isFetchingHistory) return;

                set({ isFetchingHistory: true });
                try {
                    const limit = 20;
                    const url = new URL(`${getApiBase()}/history`);
                    url.searchParams.set('page', page.toString());
                    url.searchParams.set('limit', limit.toString());
                    if (userStore.currentUser?.id) {
                        url.searchParams.set('userId', userStore.currentUser.id);
                    }
                    if (projectId) url.searchParams.set('projectId', projectId);

                    const res = await fetch(url.toString());
                    if (res.ok) {
                        const data = await res.json();
                        if (data.history) {
                            set((state) => {
                                let newHistory: Generation[] = [];
                                if (page === 1) {
                                    // Keep pending items that might not be in the server response yet
                                    const pendingItems = state.generationHistory.filter(item => item.status === 'pending');
                                    // Deduplicate pending items against fetched items (just in case)
                                    const fetchedIds = new Set(data.history.map((h: Generation) => h.id));
                                    const uniquePending = pendingItems.filter(item => !fetchedIds.has(item.id));

                                    newHistory = [...uniquePending, ...data.history];
                                } else {
                                    // Deduplicate when appending
                                    const existingIds = new Set(state.generationHistory.map(item => item.id));
                                    const uniqueNewItems = data.history.filter((item: Generation) => !existingIds.has(item.id));
                                    newHistory = [...state.generationHistory, ...uniqueNewItems];
                                }

                                return {
                                    generationHistory: newHistory,
                                    historyPage: page,
                                    hasMoreHistory: data.hasMore
                                };
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch history", error);
                } finally {
                    set({ isFetchingHistory: false });
                }
            },

            galleryItems: [],
            galleryPage: 1,
            hasMoreGallery: true,
            isFetchingGallery: false,
            fetchGallery: async (page = 1) => {
                const state = get();
                if (state.isFetchingGallery) return;

                set({ isFetchingGallery: true });
                try {
                    const limit = 50;
                    const url = new URL(`${getApiBase()}/history`);
                    url.searchParams.set('page', page.toString());
                    url.searchParams.set('limit', limit.toString());
                    // Intentionally NOT setting userId to get public/all data

                    const res = await fetch(url.toString());
                    if (res.ok) {
                        const data = await res.json();
                        if (data.history) {
                            set((state) => {
                                let newItems: Generation[] = [];
                                if (page === 1) {
                                    newItems = data.history;
                                } else {
                                    const existingIds = new Set(state.galleryItems.map(item => item.id));
                                    const uniqueNewItems = data.history.filter((item: Generation) => !existingIds.has(item.id));
                                    newItems = [...state.galleryItems, ...uniqueNewItems];
                                }
                                return {
                                    galleryItems: newItems,
                                    galleryPage: page,
                                    hasMoreGallery: data.hasMore
                                };
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch gallery", error);
                } finally {
                    set({ isFetchingGallery: false });
                }
            },

            addGalleryItem: (item: Generation) => {
                set((state) => ({
                    galleryItems: [item, ...state.galleryItems]
                }));
            },

            deleteHistory: async (ids: string[]) => {
                try {
                    const res = await fetch(`${getApiBase()}/history`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids })
                    });

                    if (res.ok) {
                        set((state) => ({
                            generationHistory: state.generationHistory.filter(item => !ids.includes(item.id))
                        }));
                    }
                } catch (error) {
                    console.error("Failed to delete history", error);
                }
            },

            presets: [],
            initPresets: async () => {
                try {
                    const [presetsRes, workflowsRes] = await Promise.all([
                        fetch(`${getApiBase()}/presets`),
                        fetch(`${getApiBase()}/view-comfy`)
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
                    // Initialize categories as well
                    get().initCategories();
                } catch (e) {
                    console.error("Error fetching presets and workflows:", e);
                }
            },

            presetCategories: ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'],
            initCategories: async () => {
                try {
                    const res = await fetch(`${getApiBase()}/presets/categories`);
                    if (res.ok) {
                        const data = await res.json();
                        set({ presetCategories: data });
                    }
                } catch (e) {
                    console.error("Failed to init categories", e);
                }
            },
            saveCategories: async (categories: string[]) => {
                try {
                    const res = await fetch(`${getApiBase()}/presets/categories`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(categories)
                    });
                    if (res.ok) {
                        set({ presetCategories: categories });
                    }
                } catch (e) {
                    console.error("Failed to save categories", e);
                }
            },
            renameCategory: async (oldName: string, newName: string) => {
                const state = get();
                const newCategories = state.presetCategories.map(c => c === oldName ? newName : c);

                // 1. Update category names in list
                await state.saveCategories(newCategories);

                // 2. Bulk update all affected presets
                const affectedPresets = state.presets.filter(p => p.category === oldName);
                for (const preset of affectedPresets) {
                    await state.updatePreset({ ...preset, category: newName });
                }
            },

            addPreset: async (preset: Preset, coverFile?: File) => {
                try {
                    const formData = new FormData();
                    formData.append('json', JSON.stringify(preset));
                    if (coverFile) {
                        formData.append('cover', coverFile);
                    } else if (preset.coverUrl && !preset.coverUrl.startsWith('local:') && !preset.coverUrl.startsWith('data:')) {
                        // 如果有 CDN URL，也发给后端，后端可以决定是否使用它
                        formData.append('coverUrl', preset.coverUrl);
                    }

                    const res = await fetch(`${getApiBase()}/presets`, { method: 'POST', body: formData });
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
                    const res = await fetch(`${getApiBase()}/presets?id=${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        set((state) => ({ presets: state.presets.filter(p => p.id !== id) }));
                    }
                } catch (e) {
                    console.error("Failed to delete preset", e);
                }
            },

            updatePreset: async (preset: Preset, coverFile?: File) => {
                try {
                    const formData = new FormData();
                    formData.append('json', JSON.stringify(preset));
                    if (coverFile) {
                        formData.append('cover', coverFile);
                    } else if (preset.coverUrl && !preset.coverUrl.startsWith('local:') && !preset.coverUrl.startsWith('data:')) {
                        formData.append('coverUrl', preset.coverUrl);
                    }

                    const res = await fetch(`${getApiBase()}/presets`, { method: 'POST', body: formData });
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
                    const res = await fetch(`${getApiBase()}/styles`);
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
                    const res = await fetch(`${getApiBase()}/styles`, {
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
                    const res = await fetch(`${getApiBase()}/styles`, {
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
                    const res = await fetch(`${getApiBase()}/styles?id=${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        set((state) => ({ styles: state.styles.filter(s => s.id !== id) }));
                    }
                } catch (e) {
                    console.error("Failed to delete style", e);
                }
            },

            removeImageFromStyle: async (styleId: string, imagePath: string) => {
                const state = get();
                const style = state.styles.find(s => s.id === styleId);
                if (!style) return;

                const updatedStyle = {
                    ...style,
                    imagePaths: style.imagePaths.filter(p => p !== imagePath),
                    updatedAt: new Date().toISOString()
                };

                try {
                    const res = await fetch(`${getApiBase()}/styles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedStyle)
                    });
                    if (res.ok) {
                        set((state) => ({
                            styles: state.styles.map(s => s.id === styleId ? updatedStyle : s)
                        }));
                    }
                } catch (e) {
                    console.error("Failed to remove image from style", e);
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
                    fetch(`${getApiBase()}/styles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedStyle)
                    }).catch(e => console.error("Failed to sync style image addition", e));
                    return { styles: newStyles };
                });
            },
        }), {
        name: 'playground-storage',
        partialize: (state) => ({
            // Only persist config and UI states, not large data
            config: state.config,
            selectedModel: state.selectedModel,
            selectedWorkflowConfig: state.selectedWorkflowConfig,
            selectedLoras: state.selectedLoras,
            showProjectSidebar: state.showProjectSidebar,
            isAspectRatioLocked: state.isAspectRatioLocked,
            isMockMode: state.isMockMode,
            viewMode: state.viewMode,
            presetCategories: state.presetCategories,

            // Only persist the first 20 items and strip heavy data to avoid localStorage quota (5MB) issues
            generationHistory: state.generationHistory.slice(0, 20).map(item => ({
                ...item,
                config: {
                    ...item.config,
                    // Strip potentially large objects from config.editConfig
                    editConfig: item.config?.editConfig ? {
                        ...item.config.editConfig,
                        canvasJson: {},
                        referenceImages: item.config.editConfig.referenceImages?.map(img => ({
                            ...img,
                            dataUrl: '' // Remove base64 data
                        })) || []
                    } : undefined,
                }
            }))
        }),
    }
    ));
