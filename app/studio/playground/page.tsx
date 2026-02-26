"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaygroundV2Page } from "@studio/playground/_components/containers/PlaygroundPageContainer";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import { STUDIO_ROUTES } from "../_lib/navigation";

export default function PlaygroundPage() {
  const setViewMode = usePlaygroundStore((s) => s.setViewMode);
  const router = useRouter();

  useEffect(() => {
    setViewMode("home");
  }, [setViewMode]);

  const handleEditMapping = (workflow: IViewComfy) => {
    localStorage.setItem("MAPPING_EDITOR_INITIAL_WORKFLOW", JSON.stringify(workflow));
    router.push(STUDIO_ROUTES.mappingEditor);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-white">Loading Playground...</div>}>
        <PlaygroundV2Page onEditMapping={handleEditMapping} />
      </Suspense>
    </div>
  );
}
