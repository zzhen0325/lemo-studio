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
  onApplyModelFromHistory: (result: Generation) => void;
  onDownload: (imageUrl: string) => void;
  onEdit: (result: Generation, isAgain?: boolean) => void;
  onImageClick: (result: Generation, initialRect?: DOMRect) => void;
  onUsePrompt: (result: Generation) => void;
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
  onApplyModelFromHistory,
  onDownload,
  onEdit,
  onImageClick,
  onUsePrompt,
  onBatchUse,
}: PlaygroundHistoryPanelProps) {
  return (
    <div className="mt-2 w-full relative flex-1 overflow-hidden z-30">
      <HistoryList
        variant="sidebar"
        history={history}
        onRegenerate={(result) => {
          onApplyModelFromHistory(result);
          onRegenerate(result);
        }}
        onDownload={onDownload}
        onEdit={onEdit}
        onImageClick={onImageClick}
        onUsePrompt={onUsePrompt}
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
