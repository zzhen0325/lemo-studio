"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Copy, Edit3, FolderOpen, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/common/use-toast";
import type { InfiniteCanvasProjectSummary } from "@/types/infinite-canvas";
import { createProject, deleteProject, duplicateProject, listProjects, renameProject } from "../_lib/api";

interface InfiniteCanvasProjectSidebarProps {
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function InfiniteCanvasProjectSidebar({
  activeProjectId,
  onSelectProject,
}: InfiniteCanvasProjectSidebarProps) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<InfiniteCanvasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listProjects();
      setProjects(response.projects || []);
    } catch (error) {
      toast({
        title: "项目加载失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter((project) => project.projectName.toLowerCase().includes(query));
  }, [keyword, projects]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const response = await createProject("未命名项目");
      onSelectProject(response.project.projectId);
    } catch (error) {
      toast({
        title: "新建失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }, [onSelectProject, toast]);

  const handleRename = useCallback(
    async (project: InfiniteCanvasProjectSummary) => {
      const value = window.prompt("请输入新项目名", project.projectName);
      if (!value) {
        return;
      }

      const nextName = value.trim();
      if (!nextName) {
        return;
      }

      try {
        await renameProject(project.projectId, nextName);
        await loadProjects();
      } catch (error) {
        toast({
          title: "重命名失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      }
    },
    [loadProjects, toast],
  );

  const handleDuplicate = useCallback(
    async (projectId: string) => {
      try {
        await duplicateProject(projectId);
        await loadProjects();
        toast({
          title: "复制成功",
          description: "已生成项目副本。",
        });
      } catch (error) {
        toast({
          title: "复制失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      }
    },
    [loadProjects, toast],
  );

  const handleDelete = useCallback(
    async (project: InfiniteCanvasProjectSummary) => {
      if (!window.confirm(`确认删除项目「${project.projectName}」吗？`)) {
        return;
      }

      try {
        await deleteProject(project.projectId);
        const response = await listProjects();
        const nextProjects = response.projects || [];
        setProjects(nextProjects);

        if (project.projectId !== activeProjectId) {
          return;
        }

        if (nextProjects.length > 0) {
          onSelectProject(nextProjects[0].projectId);
          return;
        }

        const created = await createProject("未命名项目");
        onSelectProject(created.project.projectId);
      } catch (error) {
        toast({
          title: "删除失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        });
      }
    },
    [activeProjectId, onSelectProject, toast],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200/90 dark:border-[#4A4C4D] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-[#A3A3A3]">Projects</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">项目列表</p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating}
            className="h-8 rounded-lg bg-zinc-900 px-3 text-xs text-white dark:bg-[#C8F88D] dark:text-[#0E0E0E] hover:opacity-90"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {creating ? "创建中..." : "新建"}
          </Button>
        </div>

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-[#737373]" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目名..."
            className="h-10 border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#161616] pl-10 text-sm text-zinc-900 dark:text-[#D9D9D9] placeholder:text-zinc-400 dark:placeholder:text-[#737373]"
          />
        </label>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-xl border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-100 dark:bg-[#2C2D2F]" />
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-transparent px-4 py-8 text-center">
            <Sparkles className="h-5 w-5 text-zinc-400 dark:text-[#A3A3A3]" />
            <p className="mt-2 text-sm text-zinc-700 dark:text-[#D9D9D9]">还没有项目</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-[#737373]">点击右上角新建项目</p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isActive = project.projectId === activeProjectId;
            return (
              <Card
                key={project.projectId}
                className={cn(
                  "overflow-hidden rounded-xl border bg-white dark:bg-[#2C2D2F] p-0",
                  isActive
                    ? "border-zinc-900/25 dark:border-[#C8F88D]/45 ring-1 ring-zinc-900/10 dark:ring-[#C8F88D]/20"
                    : "border-zinc-200 dark:border-[#4A4C4D]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.projectId)}
                  className="w-full text-left"
                >
                  <div className="relative h-20 w-full border-b border-zinc-100 dark:border-[#161616] bg-zinc-100 dark:bg-[#161616]">
                    {project.lastOutputPreview ? (
                      <Image
                        src={project.lastOutputPreview}
                        alt={project.projectName}
                        fill
                        sizes="320px"
                        className="object-cover opacity-90"
                      />
                    ) : null}
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-[#D9D9D9]">{project.projectName}</p>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-[#737373]">
                      {project.nodeCount} 节点 · {formatDate(project.updatedAt)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between border-t border-zinc-100 px-2.5 py-2 dark:border-[#161616]">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 rounded-md border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-[11px] text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
                    onClick={() => onSelectProject(project.projectId)}
                  >
                    <FolderOpen className="mr-1 h-3.5 w-3.5" />
                    打开
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
                      onClick={() => handleRename(project)}
                      title="重命名"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
                      onClick={() => handleDuplicate(project.projectId)}
                      title="复制"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md text-rose-500 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-500/15"
                      onClick={() => handleDelete(project)}
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
