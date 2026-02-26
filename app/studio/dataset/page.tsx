"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const DatasetManagerView = dynamic(() => import("./_components/DatasetManagerView"), {
  loading: () => <div className="flex h-full items-center justify-center text-white">Loading Dataset...</div>,
  ssr: false,
});

export default function DatasetPage() {
  return (
    <div className="flex flex-col flex-1 h-full w-full overflow-hidden animate-in fade-in duration-500">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Dataset...</div>}>
        <DatasetManagerView />
      </Suspense>
    </div>
  );
}
