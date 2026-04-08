"use client";

import dynamic from "next/dynamic";

const GalleryView = dynamic(() => import("@studio/playground/_components/GalleryView"), {
  loading: () => <div className="flex h-full items-center justify-center text-white">Thinking...</div>,
  ssr: false,
});

export default function GalleryPageClient() {
  return (
    <div data-testid="gallery-page-client-shell" className="flex min-h-0 flex-1 flex-col">
      <GalleryView mode="standalone" />
    </div>
  );
}
