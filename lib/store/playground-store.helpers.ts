import type { BannerModeActiveData } from '@/lib/playground/types';
import type { Generation, GenerationConfig } from '@/types/database';
import { getApiBase } from '@/lib/api-base';
import { DEFAULT_BANNER_TEMPLATE_ID, getBannerTemplateById } from '@/config/banner-templates';
import {
  buildBannerPrompt,
  createBannerModeData,
  normalizeBannerFields,
  normalizeBannerRegions,
  normalizeBannerTextPositions,
  pickBannerFieldsForHistory,
  pickBannerTextPositionsForHistory,
} from '@/lib/prompt/banner-prompt';

const galleryInFlightRequests = new Map<string, Promise<{ history: Generation[]; hasMore: boolean } | null>>();

export const fetchGalleryPageFromApi = async (page: number, limit: number) => {
  const cacheKey = `${page}-${limit}`;
  const pending = galleryInFlightRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    const url = new URL(`${getApiBase()}/history`, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1');
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('lightweight', '1');
    url.searchParams.set('minimal', '1');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    return {
      history: Array.isArray(data.history) ? (data.history as Generation[]) : [],
      hasMore: Boolean(data.hasMore),
    };
  })();

  galleryInFlightRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    galleryInFlightRequests.delete(cacheKey);
  }
};

export const mergeUniqueGalleryItems = (existing: Generation[], incoming: Generation[]) => {
  const existingIds = new Set(existing.map(item => item.id));
  const uniqueIncoming = incoming.filter(item => !existingIds.has(item.id));
  return [...existing, ...uniqueIncoming];
};

export const prependUniqueGalleryItems = (existing: Generation[], incoming: Generation[]) => {
  const existingIds = new Set(existing.map(item => item.id));
  const uniqueIncoming = incoming.filter(item => !existingIds.has(item.id));
  return [...uniqueIncoming, ...existing];
};

export const sanitizeUrlsForPersist = (urls?: string[]) =>
  urls
    ?.map(url => (url.startsWith('data:') || url.length > 1000) ? '' : url)
    .filter(Boolean) as string[] | undefined;

export const sanitizeGalleryItemsForPersist = (items: Generation[]) =>
  items.map(item => ({
    ...item,
    config: item.config
      ? {
        ...item.config,
        sourceImageUrls: sanitizeUrlsForPersist(item.config.sourceImageUrls),
      }
      : item.config,
  }));

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
  return {
    ...data,
    fields: normalizeBannerFields(data.fields),
    regions: normalizeBannerRegions(data.regions),
    textPositions: normalizeBannerTextPositions(data.textPositions || [], template),
    promptFinal: buildBannerPrompt(template, data.fields, data.regions, data.textPositions || []),
  };
};
