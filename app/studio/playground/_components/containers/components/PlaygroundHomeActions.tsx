import { Edit2, History, Image as ImageIcon, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaygroundHomeActionsProps {
  onOpenDescribe: () => void;
  onEdit: () => void;
  onOpenBanner: () => void;
  onOpenHistory: () => void;
  onOpenGallery: () => void;
}

export function PlaygroundHomeActions({
  onOpenDescribe,
  onEdit,
  onOpenBanner,
  onOpenHistory,
  onOpenGallery,
}: PlaygroundHomeActionsProps) {
  return (
    <div className="flex justify-center mt-4 gap-4">
      <button
        onClick={onOpenDescribe}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all bg-black/20",
          "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Describe</span>
      </button>
      <button
        onClick={onEdit}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <Edit2 className="w-4 h-4" />
        <span className="text-sm font-medium">Edit</span>
      </button>
      <button
        onClick={onOpenBanner}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <Square className="w-4 h-4" />
        <span className="text-sm font-medium">Banner</span>
      </button>
      <button
        onClick={onOpenHistory}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <History className="w-4 h-4" />
        <span className="text-sm font-medium">History</span>
      </button>
      <button
        onClick={onOpenGallery}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
          "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
        )}
      >
        <ImageIcon className="w-4 h-4" />
        <span className="text-sm font-medium">Gallery</span>
      </button>
    </div>
  );
}
