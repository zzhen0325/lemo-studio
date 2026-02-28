import type {
  BannerFields,
  BannerModeActiveData,
  BannerModelId,
  BannerRegionInstruction,
  BannerTextPositionInstruction,
  UploadedImage,
  Preset,
  StyleStack,
} from "@/lib/playground/types";
import type { Generation, GenerationConfig, EditPresetConfig } from "@/types/database";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { SelectedLora } from "@/lib/playground/types";

export type PlaygroundViewMode = "home" | "dock";
export type PlaygroundTab = "history" | "gallery" | "describe" | "style" | "banner";

export interface PlaygroundState {
  config: GenerationConfig;
  uploadedImages: UploadedImage[];
  describeImages: UploadedImage[];
  selectedModel: string;
  selectedWorkflowConfig: IViewComfy | undefined;
  selectedLoras: SelectedLora[];
  hasGenerated: boolean;
  showHistory: boolean;
  showGallery: boolean;
  selectedPresetName: string | undefined;
  viewMode: PlaygroundViewMode;
  activeTab: PlaygroundTab;
  editConfig?: EditPresetConfig;
  visitorId: string | undefined;
  initVisitorId: () => void;

  isSelectionMode: boolean;
  selectedHistoryIds: Set<string>;
  setIsSelectionMode: (val: boolean) => void;
  toggleHistorySelection: (id: string) => void;
  setHistorySelection: (ids: string[]) => void;
  clearHistorySelection: () => void;

  updateConfig: (config: Partial<GenerationConfig>) => void;
  setUploadedImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
  setDescribeImages: (images: UploadedImage[] | ((prev: UploadedImage[]) => UploadedImage[])) => void;
  setSelectedModel: (model: string) => void;
  setSelectedWorkflowConfig: (workflow: IViewComfy | undefined, presetName?: string) => void;
  setSelectedLoras: (loras: SelectedLora[]) => void;
  setHasGenerated: (val: boolean) => void;
  setShowHistory: (val: boolean) => void;
  setShowGallery: (val: boolean) => void;
  setSelectedPresetName: (name: string | undefined) => void;
  setViewMode: (mode: PlaygroundViewMode) => void;
  setActiveTab: (tab: PlaygroundTab) => void;
  updateUploadedImage: (id: string, updates: Partial<UploadedImage>) => void;
  updateDescribeImage: (id: string, updates: Partial<UploadedImage>) => void;
  updateHistorySourceUrl: (oldUrl: string, newUrl: string) => void;
  syncLocalImageToHistory: (localId: string, serverPath: string) => Promise<void>;

  isAspectRatioLocked: boolean;
  setAspectRatioLocked: (locked: boolean) => void;
  isSelectorExpanded: boolean;
  setSelectorExpanded: (expanded: boolean) => void;

  applyPrompt: (prompt: string) => void;
  applyImage: (imageUrl: string) => Promise<void>;
  applyImages: (imageUrls: string[]) => Promise<void>;
  applyModel: (model: string, configData?: GenerationConfig) => void;
  remix: (result: Generation) => void;
  resetState: () => void;

  generationHistory: Generation[];
  setGenerationHistory: (history: Generation[] | ((prev: Generation[]) => Generation[])) => void;
  syncHistoryWithSWR: (swrHistory: Generation[]) => void;

  pendingGenerations: Generation[];
  addPendingGeneration: (item: Generation) => void;
  updatePendingGeneration: (id: string, updates: Partial<Generation>) => void;
  removePendingGeneration: (id: string) => void;

  presets: (Preset & { workflow_id?: string })[];
  initPresets: () => void;
  addPreset: (preset: Preset, coverFile?: File) => void;
  removePreset: (id: string) => void;
  updatePreset: (preset: Preset, coverFile?: File) => void;

  styles: StyleStack[];
  initStyles: () => void;
  addStyle: (style: StyleStack) => Promise<void>;
  updateStyle: (style: StyleStack) => void;
  deleteStyle: (id: string) => Promise<void>;
  removeImageFromStyle: (styleId: string, imagePath: string) => Promise<void>;
  addImageToStyle: (styleId: string, imagePath: string) => Promise<void>;

  presetCategories: string[];
  initCategories: () => void;
  saveCategories: (categories: string[]) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;

  previewImageUrl: string | null;
  previewLayoutId: string | null;
  setPreviewImage: (url: string | null, layoutId?: string | null) => void;

  galleryItems: Generation[];
  galleryPage: number;
  hasMoreGallery: boolean;
  isFetchingGallery: boolean;
  isSyncingGalleryLatest: boolean;
  galleryLastSyncAt: number | null;
  isPrefetchingGallery: boolean;
  galleryPrefetch: { page: number; items: Generation[]; hasMore: boolean } | null;
  fetchGallery: (page?: number) => Promise<void>;
  syncGalleryLatest: () => Promise<void>;
  prefetchGalleryNext: () => Promise<void>;
  addGalleryItem: (item: Generation) => void;
  deleteHistory: (ids: string[]) => Promise<void>;

  _presetsLoading: boolean;
  _presetsLoaded: boolean;
  _galleryLoaded: boolean;

  bannerModeBackup: {
    config: GenerationConfig;
    selectedModel: string;
    selectedWorkflowConfig: IViewComfy | undefined;
    selectedLoras: SelectedLora[];
    selectedPresetName: string | undefined;
  } | null;
  activeBannerData: BannerModeActiveData | null;
  enterBannerMode: (templateId?: string) => void;
  initBannerData: (templateId?: string) => void;
  updateBannerFields: (fields: Partial<BannerFields>) => void;
  updateBannerRegions: (regions: BannerRegionInstruction[], snapshot?: Record<string, unknown>) => void;
  updateBannerTextPositions: (textPositions: BannerTextPositionInstruction[]) => void;
  updateBannerPromptFinal: (promptFinal: string) => void;
  resetBannerPromptFinal: () => void;
  setBannerModel: (model: BannerModelId) => void;
  resetBannerMode: () => void;
}
