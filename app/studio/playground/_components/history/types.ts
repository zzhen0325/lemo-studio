import type { Generation } from '@/types/database';

export interface HistoryListProps {
  history: Generation[];
  onRegenerate: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
  onEdit?: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  isGenerating?: boolean;
  variant?: 'default' | 'sidebar';
  onBatchUse?: (results: Generation[], sourceImage?: string) => void;
  layoutMode?: 'grid' | 'list';
  onLayoutModeChange?: (mode: 'grid' | 'list') => void;
  onClose?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export interface GroupedHistoryItem {
  type: 'image' | 'text';
  key: string;
  items: Generation[];
  sourceImage?: string;
  startAt: string;
}
