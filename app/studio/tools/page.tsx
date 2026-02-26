"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const ToolsView = dynamic(() => import("./_components/ToolsView"), {
  loading: () => <div className="flex h-full items-center justify-center text-white">Loading Tools...</div>,
  ssr: false,
});

export default function ToolsPage() {
  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Tools...</div>}>
        <ToolsView />
      </Suspense>
    </div>
  );
}
