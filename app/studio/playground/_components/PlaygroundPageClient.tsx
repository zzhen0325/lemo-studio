"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlaygroundV2Page } from "@studio/playground/_components/containers/PlaygroundPageContainer";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import { STUDIO_BACKGROUND_PREFETCH_ROUTES, STUDIO_ROUTES } from "../../_lib/navigation";

export default function PlaygroundPageClient() {
  const setViewMode = usePlaygroundStore((state) => state.setViewMode);
  const router = useRouter();

  useEffect(() => {
    setViewMode("home");
  }, [setViewMode]);

  useEffect(() => {
    let cancelled = false;
    const timerIds: number[] = [];
    let idleId: number | null = null;

    const prefetchTabs = () => {
      STUDIO_BACKGROUND_PREFETCH_ROUTES.forEach((href, index) => {
        const timerId = window.setTimeout(() => {
          if (cancelled) {
            return;
          }
          void router.prefetch(href);
        }, index * 180);
        timerIds.push(timerId);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(prefetchTabs, { timeout: 2000 });
    } else {
      const fallbackTimerId = window.setTimeout(prefetchTabs, 700);
      timerIds.push(fallbackTimerId);
    }

    return () => {
      cancelled = true;
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [router]);

  const handleEditMapping = (workflow: IViewComfy) => {
    localStorage.setItem("MAPPING_EDITOR_INITIAL_WORKFLOW", JSON.stringify(workflow));
    router.push(STUDIO_ROUTES.mappingEditor);
  };

  return <PlaygroundV2Page onEditMapping={handleEditMapping} />;
}
