import type { Generation } from '@/types/database';
import type { PromptOptimizationSourcePayload } from '@/app/studio/playground/_lib/prompt-history';

export interface HistoryListProps {
  history: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
  onEdit?: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onUsePrompt?: (result: Generation) => void;
  isGenerating?: boolean;
  variant?: 'default' | 'sidebar';
  onBatchUse?: (results: Generation[], sourceImage?: string) => void;
  layoutMode?: 'grid' | 'list';
  onLayoutModeChange?: (mode: 'grid' | 'list') => void;
  onClose?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
}

export interface GroupedHistoryItem {
  type: 'image' | 'text' | 'optimization';
  key: string;
  items: Generation[];
  sourceImage?: string;
  startAt: string;
  originalPrompt?: string;
  optimizationSource?: PromptOptimizationSourcePayload | null;
}
