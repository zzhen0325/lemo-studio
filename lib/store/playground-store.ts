import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Generation } from '../../types/database';
import { IViewComfy } from '../providers/view-comfy-provider';
import type { PlaygroundState } from './playground-store.types';
// import { userStore } from './user-store';
import { getApiBase } from "../api-base";

import { MODEL_ID_WORKFLOW } from '../constants/models';
import { isWorkflowModel } from '../utils/model-utils';
import { v4 as uuidv4 } from 'uuid';
import {
    clearBannerMetadata,
} from './playground-store.helpers';
import { createBannerActions } from './playground-store.banner-actions';
import { createLibraryActions } from './playground-store.library-actions';
import { partializePlaygroundState } from './playground-store.persist';

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
            // 防重复加载标志
            _presetsLoading: false,
            _presetsLoaded: false,
            _galleryLoaded: false,
            hasGenerated: false,
            showHistory: false,
            showGallery: false,
            selectedPresetName: undefined,
            viewMode: 'home',
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
            activeTab: 'history',
            visitorId: undefined,
            isTldrawEditorOpen: false,
            tldrawEditingImageUrl: "",
            tldrawSnapshot: undefined,
            bannerModeBackup: null,
            activeBannerData: null,
            ...createBannerActions(set, get),
            setTldrawEditorOpen: (open, imageUrl = "", snapshot) => set({
                isTldrawEditorOpen: open,
                tldrawEditingImageUrl: imageUrl,
                tldrawSnapshot: snapshot
            }),
            setSelectedPresetName: (name) => set({ selectedPresetName: name }),
            setViewMode: (mode) => set((state) => {
                const shouldLeaveBanner = mode === 'home' && state.activeTab === 'banner';
                if (shouldLeaveBanner && state.bannerModeBackup) {
                    return {
                        viewMode: mode,
                        activeTab: 'history',
                        activeBannerData: null,
                        bannerModeBackup: null,
                        config: clearBannerMetadata(state.bannerModeBackup.config),
                        selectedModel: state.bannerModeBackup.selectedModel,
                        selectedWorkflowConfig: state.bannerModeBackup.selectedWorkflowConfig,
                        selectedLoras: state.bannerModeBackup.selectedLoras,
                        selectedPresetName: state.bannerModeBackup.selectedPresetName,
                    };
                }

                const isBannerConfig = state.config.generationMode === 'banner';
                return {
                    viewMode: mode,
                    activeTab: mode === 'home' ? 'history' : state.activeTab,
                    activeBannerData: shouldLeaveBanner ? null : state.activeBannerData,
                    bannerModeBackup: shouldLeaveBanner ? null : state.bannerModeBackup,
                    config: shouldLeaveBanner && isBannerConfig
                        ? {
                            ...clearBannerMetadata(state.config),
                            isEdit: false,
                            parentId: undefined,
                            editConfig: undefined,
                            sourceImageUrls: [],
                        }
                        : state.config,
                };
            }),
            setActiveTab: (tab) => set((state) => {
                if (tab === state.activeTab) {
                    return { activeTab: tab };
                }

                const shouldLeaveBanner = state.activeTab === 'banner' && tab !== 'banner';
                if (!shouldLeaveBanner) {
                    return { activeTab: tab };
                }

                if (state.bannerModeBackup) {
                    return {
                        activeTab: tab,
                        activeBannerData: null,
                        bannerModeBackup: null,
                        config: clearBannerMetadata(state.bannerModeBackup.config),
                        selectedModel: state.bannerModeBackup.selectedModel,
                        selectedWorkflowConfig: state.bannerModeBackup.selectedWorkflowConfig,
                        selectedLoras: state.bannerModeBackup.selectedLoras,
                        selectedPresetName: state.bannerModeBackup.selectedPresetName,
                    };
                }

                const isBannerConfig = state.config.generationMode === 'banner';
                if (!isBannerConfig) {
                    return {
                        activeTab: tab,
                        activeBannerData: null,
                        bannerModeBackup: null,
                    };
                }

                return {
                    activeTab: tab,
                    activeBannerData: null,
                    bannerModeBackup: null,
                    config: {
                        ...clearBannerMetadata(state.config),
                        isEdit: false,
                        parentId: undefined,
                        editConfig: undefined,
                        sourceImageUrls: [],
                    },
                };
            }),

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
            setSelectedWorkflowConfig: (workflow: IViewComfy | undefined, presetName?: string) => {
                const state = get();

                // Set immediate basic info
                set({
                    selectedWorkflowConfig: workflow,
                    selectedPresetName: workflow ? (presetName || state.selectedPresetName) : undefined
                });

                // If it's a lightweight workflow (missing API JSON), fetch full detail
                if (workflow && workflow.viewComfyJSON && !workflow.workflowApiJSON) {
                    const workflowId = workflow.viewComfyJSON.id;
                    if (workflowId) {
                        fetch(`${getApiBase()}/view-comfy/${workflowId}`)
                            .then(res => res.json())
                            .then(fullDetail => {
                                // Double check if user hasn't switched away
                                const currentState = get();
                                if (currentState.selectedWorkflowConfig?.viewComfyJSON?.id === workflowId) {
                                    set({
                                        selectedWorkflowConfig: fullDetail
                                    });
                                }

                                // Also update it in the presets list so we don't fetch again
                                set(s => ({
                                    presets: s.presets.map(p => {
                                        if (p.workflow_id === workflowId) {
                                            return {
                                                ...p,
                                                _fullWorkflow: fullDetail // Cache it
                                            };
                                        }
                                        return p;
                                    })
                                }));
                            })
                            .catch(err => console.error("Failed to fetch full workflow detail:", err));
                    }
                }
            },
            setSelectedLoras: (loras) => set({ selectedLoras: loras }),
            setHasGenerated: (val) => set({ hasGenerated: val }),
            setShowHistory: (val) => set({ showHistory: val }),
            setShowGallery: (val) => set({ showGallery: val }),

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
                    // Use type assertion to access sourceImageUrls
                    // TODO: Define a complete type or interface instead of using any for better type safety
                    const itemAny = newItem as unknown as { sourceImageUrls?: string[]; editConfig?: { originalImageUrl?: string } };
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
                        : { ...state.config, model: finalModel, baseModel: finalModel, isPreset: false, presetName: undefined };

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
                        selectedPresetName: configData?.presetName || (configData ? undefined : undefined)
                    };
                });
            },

            remix: (result: Generation) => {
                const state = get();
                const modelFromConfig = result.config?.baseModel || result.config?.model;
                const finalModel = (modelFromConfig as string) || state.selectedModel;
                let uiModel = finalModel;

                if (isWorkflowModel(finalModel)) {
                    uiModel = MODEL_ID_WORKFLOW;
                }

                // 1. Common State Updates
                set({
                    selectedModel: uiModel,
                    selectedLoras: result.config?.loras || [],
                    selectedPresetName: result.config?.presetName,
                    config: {
                        ...state.config,
                        ...result.config,
                        model: finalModel,
                        baseModel: finalModel,
                        isPreset: result.config?.isPreset ?? !!(result.config?.presetName),
                    },
                    hasGenerated: true
                });

                // 2. Handle Workflow Selection with Hydration Logic
                if (result.config?.presetName) {
                    const presetWorkflow = state.presets.find(p => p.id === result.id || p.name === result.config.presetName) as unknown as IViewComfy;
                    // Invoke the action to ensure full validation/hydration occurs
                    if (presetWorkflow) {
                        get().setSelectedWorkflowConfig(presetWorkflow, result.config.presetName);
                    }
                } else if (uiModel !== MODEL_ID_WORKFLOW) {
                    // If switching away from workflow model and no preset involved, clear the workflow config
                    set({ selectedWorkflowConfig: undefined });
                }
                // If uiModel IS Workflow but no specific preset name in result, we keep the *current* workflow (default behavior),
                // effectively doing nothing to selectedWorkflowConfig.
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
                    isAspectRatioLocked: false,
                    isMockMode: false,
                    isSelectorExpanded: false,
                    selectedPresetName: undefined,
                    viewMode: 'home',
                    activeTab: 'history',
                    editConfig: undefined,
                    isSelectionMode: false,
                    selectedHistoryIds: new Set(),
                    visitorId: undefined,
                    isTldrawEditorOpen: false,
                    tldrawEditingImageUrl: "",
                    tldrawSnapshot: undefined,
                    bannerModeBackup: null,
                    activeBannerData: null,
                    galleryItems: [],
                    galleryPage: 1,
                    hasMoreGallery: true,
                    isFetchingGallery: false,
                    isSyncingGalleryLatest: false,
                    galleryLastSyncAt: null,
                    isPrefetchingGallery: false,
                    galleryPrefetch: null,
                    _galleryLoaded: false,
                });
            },

            initVisitorId: () => {
                const state = get();
                if (!state.visitorId) {
                    set({ visitorId: uuidv4() });
                }
            },

            generationHistory: [],
            pendingGenerations: [],
            addPendingGeneration: (item) => set(state => ({
                pendingGenerations: [item, ...state.pendingGenerations],
                // Also optimistically add to main list for immediate display
                generationHistory: [item, ...state.generationHistory]
            })),
            updatePendingGeneration: (id, updates) => set(state => ({
                pendingGenerations: state.pendingGenerations.map(p => p.id === id ? { ...p, ...updates } : p),
                generationHistory: state.generationHistory.map(h => h.id === id ? { ...h, ...updates } : h)
            })),
            removePendingGeneration: (id) => set(state => ({
                pendingGenerations: state.pendingGenerations.filter(p => p.id !== id),
                // We don't necessarily remove from generationHistory here, as SWR might have picked it up. 
                // The sync logic will handle final consistency.
            })),

            syncHistoryWithSWR: (swrHistory) => set(state => {
                // Merge SWR history (server truth) with local pending items
                // Filter out any pending items that are already in SWR history (by ID)
                const serverIds = new Set(swrHistory.map(h => h.id));
                const uniquePending = state.pendingGenerations.filter(p => !serverIds.has(p.id));

                // If a pending item is now in server history, remove it from pending list (cleanup)
                const newPendingList = state.pendingGenerations.filter(p => !serverIds.has(p.id));

                // If the cleaned pending list is different, update it
                // Note: We return Partial<PlaygroundState>
                const updates: Partial<PlaygroundState> = {
                    generationHistory: [...uniquePending, ...swrHistory],
                };

                if (newPendingList.length !== state.pendingGenerations.length) {
                    updates.pendingGenerations = newPendingList;
                }

                return updates;
            }),
            setGenerationHistory: (updater) => set((state) => ({
                generationHistory: typeof updater === 'function' ? updater(state.generationHistory) : updater
            })),
            ...createLibraryActions(set, get),
        }), {
        name: 'playground-storage',
        partialize: partializePlaygroundState,
    }
    ));
