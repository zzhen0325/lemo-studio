import { Suspense } from "react";
import dynamic from "next/dynamic";
import { StyleStacksView } from "@studio/playground/_components/StyleStacksView";
import { BannerModePanel } from "@studio/playground/_components/Banner/BannerModePanel";
import type { PlaygroundShortcut } from "@/config/playground-shortcuts";

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
  onShortcutQuickApply?: (shortcut: PlaygroundShortcut) => void;
  isGenerating: boolean;
  onGenerateBanner: (options?: unknown) => void;
  bannerSessionHistory: BannerSessionHistoryItem[];
  isDraggingOver: boolean;
}

export function PlaygroundDockPanels({
  viewMode,
  activeTab,
  onImageClick,
  onUsePrompt,
  onShortcutQuickApply,
  isGenerating,
  onGenerateBanner,
  bannerSessionHistory,
  isDraggingOver,
}: PlaygroundDockPanelsProps) {
  return (
    <>
      {viewMode === 'dock' && activeTab === 'gallery' && (
        <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-28">
          <div className="h-full w-full  overflow-hidden relative">
            <Suspense fallback={<div className="flex w-[90%] items-center justify-center h-full text-white">Thinking...</div>}>
              <GalleryView onSelectItem={onImageClick} onUsePrompt={onUsePrompt} />
            </Suspense>
          </div>
        </div>
      )}

      {viewMode === 'dock' && activeTab === 'style' && (
        <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-32">
          <div className="h-full w-full  overflow-hidden relative">
            <Suspense fallback={<div className="flex  w-[90%] items-center justify-center h-full text-white">Thinking...</div>}>
              <StyleStacksView
                isDragging={isDraggingOver}
                onShortcutQuickApply={onShortcutQuickApply}
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
