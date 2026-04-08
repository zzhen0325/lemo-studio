import type { BannerModeActiveData } from '@/lib/playground/types';
import type { GenerationConfig } from '@/types/database';
import { DEFAULT_BANNER_TEMPLATE_ID, getBannerTemplateById } from '@/config/banner-templates';
import {
  buildBannerPrompt,
  createBannerModeData,
  loadBannerTemplatePresetRegions,
  normalizeBannerFields,
  normalizeBannerRegions,
  normalizeBannerTextPositions,
  syncBannerTextRegionDescriptions,
  pickBannerFieldsForHistory,
  pickBannerTextPositionsForHistory,
} from '@/lib/prompt/banner-prompt';

export const clearBannerMetadata = (config: GenerationConfig): GenerationConfig => {
  const nextConfig = { ...config };
  delete nextConfig.generationMode;
  delete nextConfig.bannerTemplateId;
  delete nextConfig.bannerFields;
  delete nextConfig.bannerTextPositions;
  delete nextConfig.bannerPromptFinal;
  return nextConfig;
};

export const buildBannerGenerationConfig = (baseConfig: GenerationConfig, bannerData: BannerModeActiveData): GenerationConfig => {
  const template = getBannerTemplateById(bannerData.templateId);
  if (!template) return clearBannerMetadata(baseConfig);

  return {
    ...clearBannerMetadata(baseConfig),
    prompt: bannerData.promptFinal,
    width: template.width,
    height: template.height,
    model: bannerData.model,
    baseModel: bannerData.model,
    sourceImageUrls: [template.baseImageUrl],
    loras: [],
    workflowName: undefined,
    presetName: undefined,
    isPreset: false,
    isEdit: true,
    parentId: undefined,
    editConfig: undefined,
    generationMode: 'banner',
    bannerTemplateId: template.id,
    bannerFields: pickBannerFieldsForHistory(bannerData.fields),
    bannerTextPositions: pickBannerTextPositionsForHistory(bannerData.textPositions || []),
    bannerPromptFinal: bannerData.promptFinal,
  };
};

export const getResolvedBannerData = (templateId?: string): BannerModeActiveData | null => {
  const template = getBannerTemplateById(templateId || DEFAULT_BANNER_TEMPLATE_ID);
  if (!template) return null;
  const data = createBannerModeData(template);
  const normalizedFields = normalizeBannerFields(data.fields);
  const storedTemplateRegions = loadBannerTemplatePresetRegions(template.id);
  const normalizedRegions = syncBannerTextRegionDescriptions(normalizeBannerRegions(storedTemplateRegions || data.regions));
  const normalizedTextPositions = normalizeBannerTextPositions(data.textPositions || [], template);
  return {
    ...data,
    fields: normalizedFields,
    regions: normalizedRegions,
    textPositions: normalizedTextPositions,
    promptFinal: buildBannerPrompt(template, normalizedFields, normalizedRegions, normalizedTextPositions),
  };
};
