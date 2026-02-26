"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePlaygroundStore } from "@/lib/store/playground-store";

const GalleryView = dynamic(() => import("@studio/playground/_components/GalleryView"), {
  loading: () => <div className="flex h-full items-center justify-center text-white">Loading Gallery...</div>,
  ssr: false,
});

export default function GalleryPage() {
  const setActiveTab = usePlaygroundStore((s) => s.setActiveTab);
  const setViewMode = usePlaygroundStore((s) => s.setViewMode);

  useEffect(() => {
    setViewMode("dock");
    setActiveTab("gallery");
  }, [setActiveTab, setViewMode]);

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Gallery...</div>}>
        <GalleryView />
      </Suspense>
    </div>
  );
}
