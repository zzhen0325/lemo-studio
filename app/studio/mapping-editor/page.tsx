"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const MappingEditorPage = dynamic(
  () => import("./_components/mapping-editor-page"),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-white">
        Loading Mapping Editor...
      </div>
    ),
    ssr: false,
  }
);

export default function WorkflowMappingPage() {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-white">
            Loading Mapping Editor...
          </div>
        }
      >
        <MappingEditorPage />
      </Suspense>
    </div>
  );
}
