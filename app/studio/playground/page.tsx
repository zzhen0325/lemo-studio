import { Suspense } from "react";
import PlaygroundPageClient from "./_components/PlaygroundPageClient";

export default function PlaygroundPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Playground...</div>}>
        <PlaygroundPageClient />
      </Suspense>
    </div>
  );
}
