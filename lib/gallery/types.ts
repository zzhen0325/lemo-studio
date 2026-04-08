import type { GalleryPromptCategory } from '@/app/studio/playground/_lib/prompt-history';
import type { SortBy } from '@/lib/server/service/history.service';
import type { Generation, StyleStack } from '@/types/database';
import type { MoodboardCard } from '@/config/moodboard-cards';

export type GalleryInnerTab = 'gallery' | 'prompt';

export interface GalleryFilterState {
  searchQuery: string;
  selectedModels: string[];
  selectedPresets: string[];
  selectedPromptCategories: GalleryPromptCategory[];
}

export interface GalleryFilterOptions {
  models: string[];
  presets: string[];
}

export interface GalleryFeedPage {
  history: Generation[];
  hasMore: boolean;
  total?: number;
}

export interface GalleryItemViewModel {
  id: string;
  raw: Generation;
  displayUrl: string;
  downloadUrl: string;
  moodboardImagePath: string;
  prompt: string;
  promptCategory: GalleryPromptCategory;
  promptCategoryLabel: string;
  model: string;
  presetName: string;
  createdAt: string;
  width: number;
  height: number;
  sourceImageUrl?: string;
  thumbnailUrl?: string;
  imageLoadKey: string;
  searchText: string;
  isPromptVisible: boolean;
  isImageVisible: boolean;
}

export interface GalleryFeedResult {
  items: GalleryItemViewModel[];
  promptItems: GalleryItemViewModel[];
  filterOptions: GalleryFilterOptions;
  hasMore: boolean;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  loadMore: () => Promise<void>;
  revalidateLatest: () => Promise<void>;
}

export interface GalleryActionHandlers {
  onSelectItem?: (item: Generation, items?: Generation[]) => void;
  onUsePrompt: (item: Generation) => void;
  onUseImage: (item: Generation) => void | Promise<void>;
  onRerun: (item: Generation) => Promise<unknown>;
  onDownload: (item: Generation, downloadUrl: string) => void;
  onAddToMoodboard?: (item: Generation) => void;
}

export interface GalleryMoodboardData {
  moodboards: StyleStack[];
  moodboardCards: MoodboardCard[];
  refreshMoodboardCards: () => Promise<void>;
}

export interface GallerySceneProps {
  feed: GalleryFeedResult;
  actions: GalleryActionHandlers;
  moodboardData: GalleryMoodboardData;
  mode: 'standalone' | 'dock';
  sortBy: Exclude<SortBy, 'interactionPriority'>;
  onSortByChange: (sortBy: Exclude<SortBy, 'interactionPriority'>) => void;
}
