import type { GenerationConfig } from '@/types/database';
import type { PlaygroundState } from './playground-store.types';
import { clearBannerMetadata, sanitizeGalleryItemsForPersist } from './playground-store.helpers';

export function partializePlaygroundState(state: PlaygroundState) {
  return {
    config: (() => {
      const isBannerConfig = state.config?.generationMode === 'banner';
      const sanitizedConfig = clearBannerMetadata(state.config || ({} as GenerationConfig));
      return {
        ...sanitizedConfig,
        sourceImageUrls: isBannerConfig
          ? []
          : sanitizedConfig?.sourceImageUrls?.map(url => (url.startsWith('data:') || url.length > 1000) ? '' : url) || [],
        editConfig: sanitizedConfig?.editConfig ? {
          ...sanitizedConfig.editConfig,
          canvasJson: {},
          referenceImages: [],
          annotations: [],
          tldrawSnapshot: undefined
        } : undefined,
        isEdit: isBannerConfig ? false : sanitizedConfig.isEdit,
        tldrawSnapshot: undefined,
        resultSnapshot: undefined
      };
    })(),
    selectedModel: state.selectedModel,
    selectedWorkflowConfig: state.selectedWorkflowConfig ? {
      viewComfyJSON: {
        id: state.selectedWorkflowConfig.viewComfyJSON?.id,
        title: state.selectedWorkflowConfig.viewComfyJSON?.title
      }
    } : undefined,
    selectedLoras: state.selectedLoras,
    isAspectRatioLocked: state.isAspectRatioLocked,
    isMockMode: state.isMockMode,
    viewMode: state.viewMode,
    visitorId: state.visitorId || `visitor_${Math.random().toString(36).substring(2, 11)}`,
    generationHistory: [],
    presets: [],
    styles: [],
    uploadedImages: [],
    describeImages: [],
    galleryItems: sanitizeGalleryItemsForPersist(state.galleryItems),
    galleryPage: state.galleryPage,
    hasMoreGallery: state.hasMoreGallery,
    galleryLastSyncAt: state.galleryLastSyncAt,
    _galleryLoaded: state.galleryItems.length > 0 || state._galleryLoaded,
  };
}
