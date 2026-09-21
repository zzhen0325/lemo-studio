import { Edit2, History, Image as ImageIcon, Layout, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PlaygroundHomeActionsProps {
  onOpenDescribe: () => void;
  onEdit: () => void;
  onOpenHistory: () => void;
  onOpenGallery: () => void;
  onKVGenerate: () => void;
}

export function PlaygroundHomeActions({
  onOpenDescribe,
  onEdit,
  onOpenHistory,
  onOpenGallery,
  onKVGenerate,
}: PlaygroundHomeActionsProps) {
  const ActionButtonToken = cn(
    "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all bg-black/20",
    "border-white/20 text-white/90 hover:bg-white/10 hover:text-white"
  );

  return (
    <div className="flex justify-center mt-4 gap-4">
      <Button
        onClick={onKVGenerate}
        className={ActionButtonToken}
      >
        <Layout className="w-4 h-4" />
        <span className="text-sm font-medium">KV generate</span>
      </Button>
      <Button
        onClick={onOpenDescribe}
        className={ActionButtonToken}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Describe</span>
      </Button>
      <Button
        onClick={onEdit}
        className={ActionButtonToken}
      >
        <Edit2 className="w-4 h-4" />
        <span className="text-sm font-medium">Edit</span>
      </Button>
      <Button
        onClick={onOpenHistory}
        className={ActionButtonToken}
      >
        <History className="w-4 h-4" />
        <span className="text-sm font-medium">History</span>
      </Button>
      <Button
        onClick={onOpenGallery}
        className={ActionButtonToken}
      >
        <ImageIcon className="w-4 h-4" />
        <span className="text-sm font-medium">Gallery</span>
      </Button>
    </div>
  );
}