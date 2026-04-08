import type { Preset, StyleStack } from '@/lib/playground/types';
import { getApiBase } from '../api-base';
import type { IViewComfy } from '../providers/view-comfy-provider';
import type { PlaygroundState } from './playground-store.types';
import type { StoreApi } from 'zustand';
import {
  buildShortcutMoodboard,
  getShortcutByMoodboardId,
} from '@/config/moodboard-cards';

type PlaygroundSet = StoreApi<PlaygroundState>['setState'];
type PlaygroundGet = StoreApi<PlaygroundState>['getState'];

function upsertStyle(styles: StyleStack[], nextStyle: StyleStack): StyleStack[] {
  const existingIndex = styles.findIndex((style) => style.id === nextStyle.id);
  if (existingIndex === -1) {
    return [nextStyle, ...styles];
  }

  return styles.map((style) => style.id === nextStyle.id ? nextStyle : style);
}

function resolveEditableStyle(styles: StyleStack[], styleId: string): StyleStack | null {
  const existingStyle = styles.find((style) => style.id === styleId);
  if (existingStyle) {
    return existingStyle;
  }

  const linkedShortcut = getShortcutByMoodboardId(styleId);
  return linkedShortcut ? buildShortcutMoodboard(linkedShortcut) : null;
}

export function createLibraryActions(set: PlaygroundSet, get: PlaygroundGet): Pick<
  PlaygroundState,
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
  | '_stylesLoading'
  | '_stylesLoaded'
  | 'initStyles'
  | 'addStyle'
  | 'updateStyle'
  | 'deleteStyle'
  | 'removeImageFromStyle'
  | 'addImageToStyle'
> {
  return {
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
    _stylesLoading: false,
    _stylesLoaded: false,
    initStyles: async () => {
      const state = get();
      if (state._stylesLoading || state._stylesLoaded) {
        return;
      }

      set({ _stylesLoading: true });
      try {
        const res = await fetch(`${getApiBase()}/styles`);
        if (res.ok) {
          const data = await res.json();
          set({
            styles: Array.isArray(data) ? data : [],
            _stylesLoading: false,
            _stylesLoaded: true,
          });
          return;
        }
      } catch (e) {
        console.error("Error fetching styles:", e);
      }
      set({ _stylesLoading: false });
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
          set((state) => ({
            styles: upsertStyle(state.styles, savedStyle),
            _stylesLoaded: true,
          }));
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
            styles: upsertStyle(state.styles, savedStyle),
            _stylesLoaded: true,
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
          set((state) => ({
            styles: state.styles.filter((style) => style.id !== id),
            _stylesLoaded: true,
          }));
        }
      } catch (e) {
        console.error("Failed to delete style", e);
      }
    },

    removeImageFromStyle: async (styleId: string, imagePath: string) => {
      const state = get();
      const style = resolveEditableStyle(state.styles, styleId);
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
          const savedStyle = await res.json();
          set((current) => ({
            styles: upsertStyle(current.styles, savedStyle),
            _stylesLoaded: true,
          }));
        }
      } catch (e) {
        console.error("Failed to remove image from style", e);
      }
    },

    addImageToStyle: async (styleId: string, imagePath: string) => {
      set((state) => {
        const style = resolveEditableStyle(state.styles, styleId);
        if (!style) return state;
        if (style.imagePaths.includes(imagePath)) return state;
        const updatedStyle = {
          ...style,
          imagePaths: [...style.imagePaths, imagePath],
          updatedAt: new Date().toISOString()
        };
        const newStyles = upsertStyle(state.styles, updatedStyle);
        fetch(`${getApiBase()}/styles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedStyle)
        }).catch(e => console.error("Failed to sync style image addition", e));
        return { styles: newStyles, _stylesLoaded: true };
      });
    },
  };
}
