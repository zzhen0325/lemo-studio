import { Suspense } from "react";
import GalleryPageClient from "./_components/GalleryPageClient";

export default function GalleryPage() {
  return (
    <div
      data-testid="gallery-route-shell"
      className="flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in duration-500"
    >
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Thinking...</div>}>
        <GalleryPageClient />
      </Suspense>
    </div>
  );
}
