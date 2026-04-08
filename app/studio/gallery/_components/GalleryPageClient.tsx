"use client";

import GalleryView from "@studio/playground/_components/GalleryView";

export default function GalleryPageClient() {
  return (
    <div data-testid="gallery-page-client-shell" className="flex min-h-0 flex-1 flex-col">
      <GalleryView mode="standalone" />
    </div>
  );
}
