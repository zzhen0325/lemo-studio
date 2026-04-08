"use client";

import { useEffect } from "react";
import GalleryView from "@studio/playground/_components/GalleryView";
import { usePlaygroundStore } from "@/lib/store/playground-store";

export default function GalleryPageClient() {
  const setActiveTab = usePlaygroundStore((state) => state.setActiveTab);
  const setViewMode = usePlaygroundStore((state) => state.setViewMode);

  useEffect(() => {
    setViewMode("dock");
    setActiveTab("gallery");
  }, [setActiveTab, setViewMode]);

  return (
    <div data-testid="gallery-page-client-shell" className="flex min-h-0 flex-1 flex-col">
      <GalleryView />
    </div>
  );
}
