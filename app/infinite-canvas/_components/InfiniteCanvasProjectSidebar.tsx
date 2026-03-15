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
      <div className="border-b border-studio-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-studio-muted">Projects</p>
            <p className="mt-1 text-sm font-semibold text-studio-foreground">项目列表</p>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating}
            className="studio-action-button h-8 rounded-lg px-3 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {creating ? "创建中..." : "新建"}
          </Button>
        </div>

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-studio-subtle" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目名..."
            className="studio-input h-10 pl-10 text-sm"
          />
        </label>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="studio-panel h-24 animate-pulse rounded-xl bg-studio-surface-strong dark:bg-studio-surface" />
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-studio-border bg-studio-surface-muted/60 px-4 py-8 text-center">
            <Sparkles className="h-5 w-5 text-studio-muted" />
            <p className="mt-2 text-sm text-studio-foreground">还没有项目</p>
            <p className="mt-1 text-xs text-studio-subtle">点击右上角新建项目</p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isActive = project.projectId === activeProjectId;
            return (
              <Card
                key={project.projectId}
                className={cn(
                  "studio-panel overflow-hidden rounded-xl p-0",
                  isActive
                    ? "border-studio-accent/25 ring-1 ring-studio-accent/10 dark:border-[#C8F88D]/45 dark:ring-[#C8F88D]/20"
                    : "",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.projectId)}
                  className="w-full text-left"
                >
                  <div className="relative h-20 w-full border-b border-studio-surface-muted bg-studio-surface-strong dark:border-studio-canvas dark:bg-studio-surface-muted">
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
                    <p className="truncate text-sm font-semibold text-studio-foreground">{project.projectName}</p>
                    <p className="mt-1 text-[11px] text-studio-subtle">
                      {project.nodeCount} 节点 · {formatDate(project.updatedAt)}
                    </p>
                  </div>
                </button>

                <div className="flex items-center justify-between border-t border-studio-surface-muted px-2.5 py-2 dark:border-studio-canvas">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="studio-secondary-button h-7 rounded-md text-[11px]"
                    onClick={() => onSelectProject(project.projectId)}
                  >
                    <FolderOpen className="mr-1 h-3.5 w-3.5" />
                    打开
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="studio-icon-button h-7 w-7 rounded-md"
                      onClick={() => handleRename(project)}
                      title="重命名"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="studio-icon-button h-7 w-7 rounded-md"
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
