import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MoodboardView } from "@studio/playground/_components/MoodboardView";
import { BannerModePanel } from "@studio/playground/_components/Banner/BannerModePanel";
import type { MoodboardCard } from "@/config/moodboard-cards";
import type { PlaygroundHistoryController } from "@studio/playground/_components/hooks/useHistory";

const GalleryView = dynamic(() => import("@studio/playground/_components/GalleryView"), {
  loading: () => <div className="flex items-center justify-center h-full text-white">Thinking...</div>,
  ssr: false
});

interface BannerSessionHistoryItem {
  id: string;
  outputUrl: string;
  createdAt: string;
  templateId: string;
}

interface PlaygroundDockPanelsProps {
  viewMode: 'home' | 'dock';
  activeTab: 'gallery' | 'describe' | 'style' | 'banner' | 'history';
  onImageClick: (result: import("@/types/database").Generation) => void;
  onUsePrompt?: (result: import("@/types/database").Generation) => void;
  onUseImage?: (result: import("@/types/database").Generation) => void | Promise<void>;
  onShortcutQuickApply?: (moodboardCard: MoodboardCard) => void;
  onMoodboardApply?: () => void;
  isGenerating: boolean;
  onGenerateBanner: (options?: unknown) => void;
  bannerSessionHistory: BannerSessionHistoryItem[];
  isDraggingOver: boolean;
  historyController?: Pick<PlaygroundHistoryController, 'setHistory' | 'getHistoryItem'>;
}

export function PlaygroundDockPanels({
  viewMode,
  activeTab,
  onImageClick,
  onUsePrompt,
  onUseImage,
  onShortcutQuickApply,
  onMoodboardApply,
  isGenerating,
  onGenerateBanner,
  bannerSessionHistory,
  isDraggingOver,
  historyController,
}: PlaygroundDockPanelsProps) {
  return (
    <>
      {viewMode === 'dock' && activeTab === 'gallery' && (
        <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-28">
          <div className="h-full w-full  overflow-hidden relative">
            <Suspense fallback={<div className="flex w-[90%] items-center justify-center h-full text-white">Thinking...</div>}>
              <GalleryView
                onSelectItem={onImageClick}
                onUsePrompt={onUsePrompt}
                onUseImage={onUseImage}
                historyController={historyController}
              />
            </Suspense>
          </div>
        </div>
      )}

      {viewMode === 'dock' && activeTab === 'style' && (
        <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-32">
          <div className="h-full w-full  overflow-hidden relative">
            <Suspense fallback={<div className="flex  w-[90%] items-center justify-center h-full text-white">Thinking...</div>}>
              <MoodboardView
                isDragging={isDraggingOver}
                onShortcutQuickApply={onShortcutQuickApply}
                onMoodboardApply={onMoodboardApply}
              />
            </Suspense>
          </div>
        </div>
      )}

      {viewMode === 'dock' && activeTab === 'banner' && (
        <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <BannerModePanel
            isGenerating={isGenerating}
            onGenerate={onGenerateBanner}
            sessionHistory={bannerSessionHistory}
          />
        </div>
      )}
    </>
  );
}
