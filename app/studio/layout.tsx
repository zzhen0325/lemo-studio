"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { StudioSidebar } from "./_components/StudioSidebar";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import TldrawEditorModal from "@studio/playground/_components/Dialogs/TldrawEditorModal";
import { useToast } from "@/hooks/common/use-toast";
import { useImageUpload } from "@/hooks/common/use-image-upload";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const { isTldrawEditorOpen, setTldrawEditorOpen, tldrawEditingImageUrl, tldrawSnapshot } = usePlaygroundStore();
  const { toast } = useToast();
  const { uploadFile } = useImageUpload();
  const setUploadedImages = usePlaygroundStore((s) => s.setUploadedImages);

  const handleSaveTldrawImage = React.useCallback(
    async (dataUrl: string, prompt?: string) => {
      try {
        if (prompt) {
          usePlaygroundStore.getState().applyPrompt(prompt);
        }

        if (!dataUrl) {
          setTldrawEditorOpen(false);
          return;
        }

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `tldraw-${Date.now()}.png`, { type: "image/png" });

        await uploadFile(file, {
          onLocalPreview: (image) => {
            setUploadedImages((prev) => [image, ...prev]);
            setTldrawEditorOpen(false);
            toast({
              title: "标注已保存",
              description: "编辑后的图片已添加到输入框，Prompt 已更新。",
            });
          },
          onSuccess: (tempId, path) => {
            usePlaygroundStore.getState().updateUploadedImage(tempId, { path, isUploading: false });
          },
        });
      } catch (error) {
        console.error("Failed to save tldraw image:", error);
        toast({ title: "保存失败", description: "无法处理导出的图片", variant: "destructive" });
      }
    },
    [setTldrawEditorOpen, setUploadedImages, toast, uploadFile]
  );

  return (
    <div className={cn("flex flex-col h-screen w-screen overflow-hidden text-neutral-200 selection:bg-indigo-500/30 relative bg-black")}>
      <StudioSidebar />
      <main className="flex-1 relative h-full flex flex-col overflow-hidden w-full mx-auto">{children}</main>

      <TldrawEditorModal
        isOpen={isTldrawEditorOpen}
        imageUrl={tldrawEditingImageUrl}
        onClose={() => setTldrawEditorOpen(false)}
        onSave={handleSaveTldrawImage}
        initialSnapshot={tldrawSnapshot}
      />
    </div>
  );
}
