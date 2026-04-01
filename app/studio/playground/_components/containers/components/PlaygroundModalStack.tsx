import dynamic from "next/dynamic";
import NextImage from "next/image";
import { Image as ImageIcon } from "lucide-react";
import {
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import type { ImageEditConfirmPayload, ImageEditorSessionSnapshot } from "@/components/image-editor";
import SimpleImagePreview from "@studio/playground/_components/SimpleImagePreview";
import type { Generation } from "@/types/database";
import { formatImageUrl } from "@/lib/api-base";

const ImagePreviewModal = dynamic(
  () => import("@studio/playground/_components/Dialogs/ImagePreviewModal"),
  { ssr: false },
);
const FluxKleinConnectionHelpDialog = dynamic(
  () => import("@studio/playground/_components/Dialogs/FluxKleinConnectionHelpDialog"),
  { ssr: false },
);
const ImageEditDialog = dynamic(
  () => import("@/components/image-editor").then((module) => module.ImageEditDialog),
  { ssr: false },
);

export interface PlaygroundModalImageEditState {
  open: boolean;
  imageUrl: string;
  initialPrompt: string;
  initialSession?: ImageEditorSessionSnapshot;
  legacySnapshot?: Record<string, unknown>;
  initialModelId?: string;
  initialImageSize?: string;
  initialAspectRatio?: string;
  initialBatchSize?: number;
}

interface PlaygroundModalStackProps {
  selectedResultPreviewKey: string;
  isImageModalOpen: boolean;
  onCloseImageModal: () => void;
  selectedResult?: Generation;
  previewableHistory: Generation[];
  currentIndex: number;
  isHydratingSelectedResult: boolean;
  onSelectResult: (result: Generation) => void;
  onEditImage: (result: Generation) => void;
  onNextImage: () => void;
  onPrevImage: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  onRegenerate: (result: Generation) => void;
  selectedShortcutPreviewKey: string;
  selectedShortcutPreviewResult?: Generation;
  onCloseShortcutPreview: () => void;
  shortcutPreviewResults: Generation[];
  shortcutPreviewCurrentIndex: number;
  onSelectShortcutPreview: (result: Generation) => void;
  onNextShortcutPreview: () => void;
  onPrevShortcutPreview: () => void;
  shortcutPreviewHasNext: boolean;
  shortcutPreviewHasPrev: boolean;
  imageEditState: PlaygroundModalImageEditState;
  onImageEditOpenChange: (open: boolean) => void;
  onImageEditConfirm: (payload: ImageEditConfirmPayload) => void;
  fluxKleinConnectionHelp: {
    comfyUrl?: string;
    technicalReason?: string;
  } | null;
  onDismissFluxKleinConnectionHelp: () => void;
  previewImageUrl: string | null;
  previewLayoutId: string | null;
  onClosePreviewImage: () => void;
  activeDragItem: Generation | null;
  selectedHistoryCount: number;
}

export function PlaygroundModalStack({
  selectedResultPreviewKey,
  isImageModalOpen,
  onCloseImageModal,
  selectedResult,
  previewableHistory,
  currentIndex,
  isHydratingSelectedResult,
  onSelectResult,
  onEditImage,
  onNextImage,
  onPrevImage,
  hasNext,
  hasPrev,
  onRegenerate,
  selectedShortcutPreviewKey,
  selectedShortcutPreviewResult,
  onCloseShortcutPreview,
  shortcutPreviewResults,
  shortcutPreviewCurrentIndex,
  onSelectShortcutPreview,
  onNextShortcutPreview,
  onPrevShortcutPreview,
  shortcutPreviewHasNext,
  shortcutPreviewHasPrev,
  imageEditState,
  onImageEditOpenChange,
  onImageEditConfirm,
  fluxKleinConnectionHelp,
  onDismissFluxKleinConnectionHelp,
  previewImageUrl,
  previewLayoutId,
  onClosePreviewImage,
  activeDragItem,
  selectedHistoryCount,
}: PlaygroundModalStackProps) {
  return (
    <>
      <ImagePreviewModal
        key={selectedResultPreviewKey}
        isOpen={isImageModalOpen}
        onClose={onCloseImageModal}
        result={selectedResult}
        results={previewableHistory}
        currentIndex={currentIndex}
        isLoadingDetails={isHydratingSelectedResult}
        onSelectResult={onSelectResult}
        onEdit={onEditImage}
        onNext={onNextImage}
        onPrev={onPrevImage}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onRegenerate={onRegenerate}
      />

      <ImagePreviewModal
        key={selectedShortcutPreviewKey}
        isOpen={Boolean(selectedShortcutPreviewResult)}
        onClose={onCloseShortcutPreview}
        result={selectedShortcutPreviewResult}
        results={shortcutPreviewResults}
        currentIndex={shortcutPreviewCurrentIndex}
        onSelectResult={onSelectShortcutPreview}
        onNext={onNextShortcutPreview}
        onPrev={onPrevShortcutPreview}
        hasNext={shortcutPreviewHasNext}
        hasPrev={shortcutPreviewHasPrev}
      />

      <ImageEditDialog
        open={imageEditState.open}
        imageUrl={imageEditState.imageUrl}
        initialPrompt={imageEditState.initialPrompt}
        initialSession={imageEditState.initialSession}
        legacyTldrawSnapshot={imageEditState.legacySnapshot}
        generationContext="playground"
        initialModelId={imageEditState.initialModelId}
        initialImageSize={imageEditState.initialImageSize}
        initialAspectRatio={imageEditState.initialAspectRatio}
        initialBatchSize={imageEditState.initialBatchSize}
        onOpenChange={onImageEditOpenChange}
        onConfirm={onImageEditConfirm}
      />

      <FluxKleinConnectionHelpDialog
        open={Boolean(fluxKleinConnectionHelp)}
        comfyUrl={fluxKleinConnectionHelp?.comfyUrl}
        technicalReason={fluxKleinConnectionHelp?.technicalReason}
        onOpenChange={(open) => {
          if (!open) {
            onDismissFluxKleinConnectionHelp();
          }
        }}
      />

      <SimpleImagePreview
        imageUrl={previewImageUrl}
        layoutId={previewLayoutId}
        onClose={onClosePreviewImage}
      />

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}
        modifiers={[snapCenterToCursor]}
      >
        {activeDragItem ? (
          <div className="flex items-center w-[200px] gap-3 p-3 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl pointer-events-none">
            {activeDragItem.outputUrl ? (
              <NextImage
                src={formatImageUrl(activeDragItem.outputUrl)}
                alt="dragging"
                width={40}
                height={40}
                unoptimized
                className="w-10 h-10 object-cover rounded-lg border border-white/10"
              />
            ) : (
              <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                <ImageIcon className="w-4 h-4 text-white/20" />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-white">
                Moving {selectedHistoryCount} items
              </span>
              <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider">
                Release to move
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
}
