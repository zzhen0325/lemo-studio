import type { Preset, StyleStack } from '@/lib/playground/types';
import type { Generation } from '@/types/database';
import { getApiBase } from '../api-base';
import type { IViewComfy } from '../providers/view-comfy-provider';
import type { PlaygroundState } from './playground-store.types';
import type { StoreApi } from 'zustand';
import {
  fetchGalleryPageFromApi,
  mergeUniqueGalleryItems,
  prependUniqueGalleryItems,
} from './playground-store.helpers';
import { mergeShortcutMoodboards } from '@/config/playground-shortcuts';

type PlaygroundSet = StoreApi<PlaygroundState>['setState'];
type PlaygroundGet = StoreApi<PlaygroundState>['getState'];

export function createLibraryActions(set: PlaygroundSet, get: PlaygroundGet): Pick<
  PlaygroundState,
  | 'galleryItems'
  | 'galleryPage'
  | 'hasMoreGallery'
  | 'isFetchingGallery'
  | 'isSyncingGalleryLatest'
  | 'galleryLastSyncAt'
  | 'isPrefetchingGallery'
  | 'galleryPrefetch'
  | 'fetchGallery'
  | 'syncGalleryLatest'
  | 'prefetchGalleryNext'
  | 'addGalleryItem'
  | 'deleteHistory'
  | 'presets'
  | 'initPresets'
  | 'presetCategories'
  | 'initCategories'
  | 'saveCategories'
  | 'renameCategory'
  | 'addPreset'
  | 'removePreset'
  | 'updatePreset'
  | 'styles'
  | 'initStyles'
  | 'addStyle'
  | 'updateStyle'
  | 'deleteStyle'
  | 'removeImageFromStyle'
  | 'addImageToStyle'
> {
  return {
    galleryItems: [],
    galleryPage: 1,
    hasMoreGallery: true,
    isFetchingGallery: false,
    isSyncingGalleryLatest: false,
    galleryLastSyncAt: null,
    isPrefetchingGallery: false,
    galleryPrefetch: null,
    fetchGallery: async (page = 1) => {
      const state = get();
      if (page > 1 && page <= state.galleryPage) return;
      if (state.isFetchingGallery || (page === 1 && state._galleryLoaded)) return;

      if (page > 1 && state.galleryPrefetch?.page === page) {
        const cachedPage = state.galleryPrefetch;
        set((current) => ({
          galleryItems: mergeUniqueGalleryItems(current.galleryItems, cachedPage.items),
          galleryPage: page,
          hasMoreGallery: cachedPage.hasMore,
          galleryPrefetch: null
        }));

        if (cachedPage.hasMore) {
          void get().prefetchGalleryNext();
        }
        return;
      }

      if (page === 1) {
        set({ isFetchingGallery: true, galleryPrefetch: null });
      } else {
        set({ isFetchingGallery: true });
      }

      let loadedSuccessfully = false;
      let hasMoreAfterLoad = false;
      try {
        const limit = page === 1 ? 24 : 30;
        const data = await fetchGalleryPageFromApi(page, limit);
        if (!data) return;

        loadedSuccessfully = true;
        hasMoreAfterLoad = data.hasMore;

        set((current) => ({
          galleryItems: page === 1
            ? data.history
            : mergeUniqueGalleryItems(current.galleryItems, data.history),
          galleryPage: page,
          hasMoreGallery: data.hasMore,
          galleryLastSyncAt: page === 1 ? Date.now() : current.galleryLastSyncAt,
          galleryPrefetch:
            current.galleryPrefetch && current.galleryPrefetch.page > page
              ? current.galleryPrefetch
              : null
        }));
      } catch (error) {
        console.error("Failed to fetch gallery", error);
      } finally {
        set({ isFetchingGallery: false });
        if (page === 1 && loadedSuccessfully) set({ _galleryLoaded: true });
        if (loadedSuccessfully && hasMoreAfterLoad) {
          void get().prefetchGalleryNext();
        }
      }
    },
    syncGalleryLatest: async () => {
      const state = get();
      if (state.isFetchingGallery || state.isSyncingGalleryLatest) return;
      if (state.galleryItems.length === 0) return;

      const now = Date.now();
      if (state.galleryLastSyncAt && now - state.galleryLastSyncAt < 15_000) return;

      set({ isSyncingGalleryLatest: true });
      try {
        const data = await fetchGalleryPageFromApi(1, 24);
        if (!data) return;

        set((current) => {
          const merged = prependUniqueGalleryItems(current.galleryItems, data.history);
          const hasNewItems = merged.length > current.galleryItems.length;
          return {
            galleryItems: merged,
            hasMoreGallery: current.galleryPage > 1 ? current.hasMoreGallery : data.hasMore,
            galleryLastSyncAt: Date.now(),
            galleryPrefetch: hasNewItems ? null : current.galleryPrefetch,
            _galleryLoaded: merged.length > 0
          };
        });
      } catch (error) {
        console.error("Failed to sync latest gallery", error);
      } finally {
        set({ isSyncingGalleryLatest: false });
      }
    },
    prefetchGalleryNext: async () => {
      const state = get();
      if (state.activeTab !== 'gallery') return;
      if (!state.hasMoreGallery || state.isFetchingGallery || state.isPrefetchingGallery || state.isSyncingGalleryLatest) return;

      const nextPage = state.galleryPage + 1;
      if (state.galleryPrefetch?.page === nextPage) return;
      if (state.galleryPrefetch && state.galleryPrefetch.page > nextPage) return;

      set({ isPrefetchingGallery: true });
      try {
        const data = await fetchGalleryPageFromApi(nextPage, 30);
        if (!data) return;

        set((current) => {
          if (current.galleryPage >= nextPage) {
            if (current.galleryPrefetch?.page === nextPage) {
              return { galleryPrefetch: null };
            }
            return {};
          }

          if (current.galleryPrefetch && current.galleryPrefetch.page >= nextPage) {
            return {};
          }

          return {
            galleryPrefetch: {
              page: nextPage,
              items: data.history,
              hasMore: data.hasMore
            }
          };
        });
      } catch (error) {
        console.error("Failed to prefetch gallery", error);
      } finally {
        set({ isPrefetchingGallery: false });
      }
    },

    addGalleryItem: (item: Generation) => {
      set((state) => {
        if (state.galleryItems.some(i => i.id === item.id)) return state;
        return {
          galleryItems: [item, ...state.galleryItems],
          _galleryLoaded: true,
          galleryLastSyncAt: Date.now()
        };
      });
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
            generationHistory: state.generationHistory.filter(item => !ids.includes(item.id)),
            galleryItems: state.galleryItems.filter(item => !ids.includes(item.id)),
            galleryPrefetch: state.galleryPrefetch
              ? {
                ...state.galleryPrefetch,
                items: state.galleryPrefetch.items.filter(item => !ids.includes(item.id))
              }
              : null,
            _galleryLoaded: state.galleryItems.some(item => !ids.includes(item.id))
          }));
        }
      } catch (error) {
        console.error("Failed to delete history", error);
      }
    },

    presets: [],
    initPresets: async () => {
      const state = get();
      if (state._presetsLoading || state._presetsLoaded) return;
      set({ _presetsLoading: true });
      try {
        const [presetsRes, workflowsRes] = await Promise.all([
          fetch(`${getApiBase()}/presets`),
          fetch(`${getApiBase()}/view-comfy?lightweight=true`)
        ]);

        let allPresets: Preset[] = [];

        if (presetsRes.ok) {
          const presetsData = await presetsRes.json();
          allPresets = [...presetsData];
        }

        if (workflowsRes.ok) {
          const workflowsData = await workflowsRes.json();
          const isValidCoverUrl = (value?: string) => {
            if (!value) return false;
            if (value.startsWith("/upload/")) return true;
            try {
              const parsed = new URL(value);
              return parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch {
              return false;
            }
          };
          const getWorkflowCover = (wf: IViewComfy) => {
            const coverImage = wf.viewComfyJSON.coverImage;
            if (isValidCoverUrl(coverImage)) return coverImage;
            const preview = (wf.viewComfyJSON.previewImages || []).find(isValidCoverUrl);
            return preview || "";
          };
          const workflowPresets: Preset[] = (workflowsData.viewComfys || []).map((wf: IViewComfy) => ({
            id: wf.viewComfyJSON.id || `wf_${Date.now()}_${Math.random()}`,
            name: wf.viewComfyJSON.title || "Untitled Workflow",
            coverUrl: getWorkflowCover(wf),
            category: 'Workflow',
            workflow_id: wf.viewComfyJSON.id,
            config: {
              prompt: "",
              width: 1024,
              height: 1024,
              model: (() => {
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

        set({ presets: allPresets, _presetsLoaded: true });
        get().initCategories();
      } catch (e) {
        console.error("Error fetching presets and workflows:", e);
      } finally {
        set({ _presetsLoading: false });
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

      await state.saveCategories(newCategories);

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
          formData.append('coverUrl', preset.coverUrl);
        }

        const res = await fetch(`${getApiBase()}/presets`, { method: 'POST', body: formData });
        if (res.ok) {
          const savedPreset = await res.json();
          set((state) => ({ presets: [savedPreset, ...state.presets] }));
        } else {
          const errorText = await res.text();
          throw new Error(`Failed to save preset: ${res.status} ${errorText}`);
        }
      } catch (e) {
        console.error("Failed to add preset", e);
        throw e;
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

    styles: [],
    initStyles: async () => {
      try {
        const res = await fetch(`${getApiBase()}/styles`);
        if (res.ok) {
          const data = await res.json();
          set({ styles: mergeShortcutMoodboards(data) });
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
          set((state) => {
            const nextStyles = state.styles.some((item) => item.id === savedStyle.id)
              ? state.styles.map((item) => item.id === savedStyle.id ? savedStyle : item)
              : [savedStyle, ...state.styles];
            return { styles: mergeShortcutMoodboards(nextStyles) };
          });
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
            styles: mergeShortcutMoodboards(
              state.styles.map(s => s.id === savedStyle.id ? savedStyle : s)
            )
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
          set((state) => ({ styles: mergeShortcutMoodboards(state.styles.filter(s => s.id !== id)) }));
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
            styles: mergeShortcutMoodboards(state.styles.map(s => s.id === styleId ? updatedStyle : s))
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
        return { styles: mergeShortcutMoodboards(newStyles) };
      });
    },
  };
}
