import type { BannerModelId, BannerRegionInstruction, BannerTextPositionInstruction } from '@/lib/playground/types';
import type { PlaygroundState } from './playground-store.types';
import type { StoreApi } from 'zustand';
import { getBannerTemplateById } from '../../config/banner-templates';
import {
  buildBannerPrompt,
  normalizeBannerFields,
  normalizeBannerRegions,
  normalizeBannerTextPositions,
  syncBannerTextRegionDescriptions,
} from '../prompt/banner-prompt';
import {
  buildBannerGenerationConfig,
  clearBannerMetadata,
  getResolvedBannerData,
} from './playground-store.helpers';

type PlaygroundSet = StoreApi<PlaygroundState>['setState'];
type PlaygroundGet = StoreApi<PlaygroundState>['getState'];

export function createBannerActions(set: PlaygroundSet, get: PlaygroundGet): Pick<
  PlaygroundState,
  | 'enterBannerMode'
  | 'initBannerData'
  | 'updateBannerFields'
  | 'updateBannerRegions'
  | 'updateBannerTextPositions'
  | 'updateBannerPromptFinal'
  | 'resetBannerPromptFinal'
  | 'setBannerModel'
  | 'resetBannerMode'
> {
  void get;

  return {
    enterBannerMode: (templateId) => set((state) => {
      const data = getResolvedBannerData(templateId);
      if (!data) return state;
      const backup = state.activeTab === 'banner'
        ? state.bannerModeBackup
        : {
          config: clearBannerMetadata(state.config),
          selectedModel: state.selectedModel,
          selectedWorkflowConfig: state.selectedWorkflowConfig,
          selectedLoras: state.selectedLoras,
          selectedPresetName: state.selectedPresetName,
        };
      return {
        viewMode: 'dock',
        activeTab: 'banner',
        selectedModel: data.model,
        selectedPresetName: undefined,
        selectedWorkflowConfig: undefined,
        selectedLoras: [],
        bannerModeBackup: backup,
        activeBannerData: data,
        config: buildBannerGenerationConfig(state.config, data),
      };
    }),
    initBannerData: (templateId) => set((state) => {
      const data = getResolvedBannerData(templateId);
      if (!data) return state;
      return {
        bannerModeBackup: state.bannerModeBackup || {
          config: clearBannerMetadata(state.config),
          selectedModel: state.selectedModel,
          selectedWorkflowConfig: state.selectedWorkflowConfig,
          selectedLoras: state.selectedLoras,
          selectedPresetName: state.selectedPresetName,
        },
        activeBannerData: data,
        selectedModel: data.model,
        config: buildBannerGenerationConfig(state.config, data),
      };
    }),
    updateBannerFields: (fields) => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;

      const template = getBannerTemplateById(currentData.templateId);
      if (!template) return state;

      const nextFields = normalizeBannerFields({ ...currentData.fields, ...fields });
      const nextRegions = syncBannerTextRegionDescriptions(currentData.regions);
      const nextPrompt = currentData.promptEdited
        ? currentData.promptFinal
        : buildBannerPrompt(template, nextFields, nextRegions, currentData.textPositions || []);

      return {
        activeBannerData: {
          ...currentData,
          fields: nextFields,
          regions: nextRegions,
          promptFinal: nextPrompt,
        },
        config: {
          ...buildBannerGenerationConfig(state.config, {
            ...currentData,
            fields: nextFields,
            regions: nextRegions,
            promptFinal: nextPrompt,
          }),
        },
      };
    }),
    updateBannerRegions: (regions: BannerRegionInstruction[], snapshot?: Record<string, unknown>) => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;

      const template = getBannerTemplateById(currentData.templateId);
      if (!template) return state;

      const nextRegions = syncBannerTextRegionDescriptions(normalizeBannerRegions(regions));
      const nextPrompt = currentData.promptEdited
        ? currentData.promptFinal
        : buildBannerPrompt(template, currentData.fields, nextRegions, currentData.textPositions || []);

      return {
        activeBannerData: {
          ...currentData,
          regions: nextRegions,
          promptFinal: nextPrompt,
          editorSnapshot: snapshot || currentData.editorSnapshot,
        },
        config: buildBannerGenerationConfig(state.config, {
          ...currentData,
          regions: nextRegions,
          promptFinal: nextPrompt,
          editorSnapshot: snapshot || currentData.editorSnapshot,
        }),
      };
    }),
    updateBannerTextPositions: (textPositions: BannerTextPositionInstruction[]) => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;

      const template = getBannerTemplateById(currentData.templateId);
      if (!template) return state;

      const nextTextPositions = normalizeBannerTextPositions(textPositions, template);
      const nextPrompt = currentData.promptEdited
        ? currentData.promptFinal
        : buildBannerPrompt(template, currentData.fields, currentData.regions, nextTextPositions);

      return {
        activeBannerData: {
          ...currentData,
          textPositions: nextTextPositions,
          promptFinal: nextPrompt,
        },
        config: buildBannerGenerationConfig(state.config, {
          ...currentData,
          textPositions: nextTextPositions,
          promptFinal: nextPrompt,
        }),
      };
    }),
    updateBannerPromptFinal: (promptFinal) => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;
      const nextPrompt = promptFinal || '';
      return {
        activeBannerData: {
          ...currentData,
          promptFinal: nextPrompt,
          promptEdited: true,
        },
        config: buildBannerGenerationConfig(state.config, {
          ...currentData,
          promptFinal: nextPrompt,
          promptEdited: true,
        }),
      };
    }),
    resetBannerPromptFinal: () => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;
      const template = getBannerTemplateById(currentData.templateId);
      if (!template) return state;

      const nextPrompt = buildBannerPrompt(template, currentData.fields, currentData.regions, currentData.textPositions || []);
      return {
        activeBannerData: {
          ...currentData,
          promptFinal: nextPrompt,
          promptEdited: false,
        },
        config: buildBannerGenerationConfig(state.config, {
          ...currentData,
          promptFinal: nextPrompt,
          promptEdited: false,
        }),
      };
    }),
    setBannerModel: (model: BannerModelId) => set((state) => {
      const currentData = state.activeBannerData;
      if (!currentData) return state;

      const template = getBannerTemplateById(currentData.templateId);
      if (!template || !template.allowedModels.includes(model)) return state;

      return {
        selectedModel: model,
        activeBannerData: {
          ...currentData,
          model,
        },
        config: buildBannerGenerationConfig(state.config, {
          ...currentData,
          model,
        }),
      };
    }),
    resetBannerMode: () => set((state) => {
      const backup = state.bannerModeBackup;
      if (backup) {
        return {
          activeBannerData: null,
          bannerModeBackup: null,
          config: clearBannerMetadata(backup.config),
          selectedModel: backup.selectedModel,
          selectedWorkflowConfig: backup.selectedWorkflowConfig,
          selectedLoras: backup.selectedLoras,
          selectedPresetName: backup.selectedPresetName,
        };
      }
      const isBannerConfig = state.config.generationMode === 'banner';
      const nextConfig = clearBannerMetadata(state.config);
      return {
        activeBannerData: null,
        bannerModeBackup: null,
        config: isBannerConfig
          ? {
            ...nextConfig,
            isEdit: false,
            parentId: undefined,
            editConfig: undefined,
            sourceImageUrls: [],
          }
          : nextConfig,
      };
    }),
  };
}
