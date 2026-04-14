import HistoryList from "@studio/playground/_components/HistoryList";
import type { Generation } from "@/types/database";

interface PlaygroundHistoryPanelProps {
  history: Generation[];
  historyLayoutMode: 'grid' | 'list';
  onHistoryLayoutModeChange: (mode: 'grid' | 'list') => void;
  onClose: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onRegenerate: (result: Generation) => void;
  onDownload: (result: Generation, imageUrl: string) => void;
  onEdit: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onUsePrompt: (result: Generation) => void;
  onUseAll: (result: Generation) => void | Promise<void>;
  onUseModel: (result: Generation) => void | Promise<void>;
  onBatchUse: (results: Generation[]) => void;
}

export function PlaygroundHistoryPanel({
  history,
  historyLayoutMode,
  onHistoryLayoutModeChange,
  onClose,
  onLoadMore,
  hasMore,
  isLoading,
  isLoadingMore,
  onRegenerate,
  onDownload,
  onEdit,
  onImageClick,
  onUsePrompt,
  onUseAll,
  onUseModel,
  onBatchUse,
}: PlaygroundHistoryPanelProps) {
  return (
    <div className="mt-2 w-full relative flex-1 overflow-hidden z-30">
      <HistoryList
        variant="sidebar"
        history={history}
        onRegenerate={onRegenerate}
        onDownload={onDownload}
        onEdit={onEdit}
        onImageClick={onImageClick}
        onUsePrompt={onUsePrompt}
        onUseAll={onUseAll}
        onUseModel={onUseModel}
        onBatchUse={onBatchUse}
        layoutMode={historyLayoutMode}
        onLayoutModeChange={onHistoryLayoutModeChange}
        onClose={onClose}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
      />
    </div>
  );
}
