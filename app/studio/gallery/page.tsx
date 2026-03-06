import { Suspense } from "react";
import GalleryPageClient from "./_components/GalleryPageClient";

export default function GalleryPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Gallery...</div>}>
        <GalleryPageClient />
      </Suspense>
    </div>
  );
}
