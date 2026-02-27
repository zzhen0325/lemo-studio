"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProject, listProjects } from "./_lib/api";

export default function InfiniteCanvasPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const openEditor = async () => {
      try {
        const response = await listProjects();
        if (cancelled) {
          return;
        }

        const latestProject = response.projects?.[0];
        if (latestProject) {
          router.replace(`/infinite-canvas/editor/${latestProject.projectId}`);
          return;
        }

        const created = await createProject("未命名项目");
        if (cancelled) {
          return;
        }
        router.replace(`/infinite-canvas/editor/${created.project.projectId}`);
      } catch (e) {
        if (cancelled) {
          return;
        }
        setError(e instanceof Error ? e.message : "项目初始化失败");
      }
    };

    void openEditor();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-[#161616] dark:text-[#D9D9D9]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在进入画布...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center text-zinc-700 dark:bg-[#161616] dark:text-[#D9D9D9]">
      <p className="text-sm">{error}</p>
      <Button onClick={() => window.location.reload()} className="h-9 rounded-lg">
        重试
      </Button>
    </div>
  );
}
