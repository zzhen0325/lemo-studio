import type { GalleryPromptCategory } from '@/app/studio/playground/_lib/prompt-history';
import type { SortBy } from '@/lib/server/service/history.service';
import type { Generation, StyleStack } from '@/types/database';
import type { MoodboardCard } from '@/config/moodboard-cards';

export type GalleryInnerTab = 'gallery' | 'prompt';

/**
 * 快捷时间窗口预设（按"最近 N 天"过滤）。值为字符串字面量，'all' 表示不限。
 */
export type GalleryTimePreset = 'all' | '1' | '7' | '30' | '90';

/**
 * 自定义日期范围（精确到日）。`from` / `to` 都是 `YYYY-MM-DD` 形式。
 * - `from` 为空表示不限起始日；`to` 为空表示不限结束日。
 * - 只设置其一即为单边区间。
 * - 起始日晚于结束日视为无效，调用方需自行校验或交换。
 */
export interface GalleryCustomDateRange {
  from?: string;
  to?: string;
}

/**
 * 任意形式的时间筛选：快捷预设 or 自定义范围。
 * 用 `{ kind: 'preset', value }` / `{ kind: 'custom', range }` 包装，保留语义可读性。
 */
export type GalleryTimeFilter =
  | { kind: 'preset'; value: GalleryTimePreset }
  | { kind: 'custom'; range: GalleryCustomDateRange };

export const GALLERY_TIME_PRESET_OPTIONS: ReadonlyArray<{
  value: GalleryTimePreset;
  label: string;
}> = [
  { value: 'all', label: '全部时间' },
  { value: '1', label: '最近 1 天' },
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天' },
];

/**
 * 向后兼容的常量：旧版消费方通过 `GALLERY_TIME_FILTER_OPTIONS` 拿到快捷预设列表。
 * 新版 API 优先使用 `GALLERY_TIME_PRESET_OPTIONS`。
 */
export const GALLERY_TIME_FILTER_OPTIONS = GALLERY_TIME_PRESET_OPTIONS;

export const DEFAULT_GALLERY_TIME_FILTER: GalleryTimeFilter = { kind: 'preset', value: 'all' };

export function isGalleryTimePreset(value: unknown): value is GalleryTimePreset {
  return value === 'all' || value === '1' || value === '7' || value === '30' || value === '90';
}

/**
 * 解析任意来源的时间筛选值（含旧版字符串字面量），统一为 `GalleryTimeFilter` 联合。
 * 对无效值回退到默认 preset `'all'`。
 */
export function normalizeGalleryTimeFilter(value: unknown): GalleryTimeFilter {
  if (value && typeof value === 'object' && 'kind' in (value as Record<string, unknown>)) {
    const candidate = value as { kind: unknown; value?: unknown; range?: unknown };
    if (candidate.kind === 'preset' && isGalleryTimePreset(candidate.value)) {
      return { kind: 'preset', value: candidate.value };
    }
    if (candidate.kind === 'custom' && candidate.range && typeof candidate.range === 'object') {
      const range = candidate.range as { from?: unknown; to?: unknown };
      return {
        kind: 'custom',
        range: {
          from: typeof range.from === 'string' && range.from ? range.from : undefined,
          to: typeof range.to === 'string' && range.to ? range.to : undefined,
        },
      };
    }
  }
  if (typeof value === 'string' && isGalleryTimePreset(value)) {
    return { kind: 'preset', value };
  }
  return DEFAULT_GALLERY_TIME_FILTER;
}

export interface GalleryFilterState {
  searchQuery: string;
  /**
   * Display names (not raw ids) of the selected models. Multiple raw ids that
   * share a display name (e.g. `seed4_0916_lemo` and `seed4_v2_0226lemo` both
   * map to `Lemo Seed`) are represented by a single display-name entry here.
   */
  selectedModels: string[];
  selectedPresets: string[];
  selectedPromptCategories: GalleryPromptCategory[];
  byMeOnly: boolean;
  timeFilter: GalleryTimeFilter;
}

export interface GalleryModelFilterOption {
  /** Display name used both as the visible label and the selection value. */
  value: string;
  /** Alias of `value` for readability at call sites that prefer `label`. */
  label: string;
  /** Underlying raw model ids that should be matched when this option is active. */
  rawIds: string[];
}

export interface GalleryFilterOptions {
  models: GalleryModelFilterOption[];
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
  previewUrl?: string;
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
  total?: number;
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
  isActive: boolean;
  actions: GalleryActionHandlers;
  moodboardData: GalleryMoodboardData;
  sortBy: Exclude<SortBy, 'interactionPriority'>;
  onSortByChange: (sortBy: Exclude<SortBy, 'interactionPriority'>) => void;
  byMeOnly?: boolean;
  onByMeOnlyChange?: (value: boolean) => void;
}
