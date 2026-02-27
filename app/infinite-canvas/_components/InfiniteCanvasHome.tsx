"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Search, FolderOpen, Copy, Edit3, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/common/use-toast';
import {
  createProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
} from '../_lib/api';
import type { InfiniteCanvasProjectSummary } from '@/types/infinite-canvas';

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function InfiniteCanvasHome() {
  const router = useRouter();
  const { toast } = useToast();

  const [projects, setProjects] = useState<InfiniteCanvasProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listProjects();
      setProjects(response.projects || []);
    } catch (error) {
      toast({
        title: '项目加载失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
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
      const response = await createProject('未命名项目');
      router.push(`/infinite-canvas/editor/${response.project.projectId}`);
    } catch (error) {
      toast({
        title: '新建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }, [router, toast]);

  const handleRename = useCallback(
    async (project: InfiniteCanvasProjectSummary) => {
      const value = window.prompt('请输入新项目名', project.projectName);
      if (!value) return;
      const nextName = value.trim();
      if (!nextName) return;

      try {
        await renameProject(project.projectId, nextName);
        await loadProjects();
      } catch (error) {
        toast({
          title: '重命名失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
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
          title: '复制成功',
          description: '已生成项目副本。',
        });
      } catch (error) {
        toast({
          title: '复制失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
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
        await loadProjects();
      } catch (error) {
        toast({
          title: '删除失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      }
    },
    [loadProjects, toast],
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#161616] text-zinc-900 dark:text-[#D9D9D9] transition-colors">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 dark:text-[#A3A3A3]">AI Infinite Canvas</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight [font-family:var(--font-instrument)]">项目首页</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-[#A3A3A3]">创建项目并进入独立无限画布编辑器，支持节点化工作流。</p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="h-11 rounded-xl bg-zinc-900 text-white dark:bg-[#C8F88D] px-5 font-semibold dark:text-[#0E0E0E] hover:opacity-90 transition-opacity"
          >
            <Plus className="mr-2 h-4 w-4" />
            {creating ? '创建中...' : '新建项目'}
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200/80 dark:border-[#4A4C4D]/50 bg-white/50 dark:bg-[#2C2D2F]/50 p-4 backdrop-blur-xl transition-colors">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-[#737373]" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索项目名..."
              className="h-11 border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#161616] pl-10 text-sm text-zinc-900 dark:text-[#D9D9D9] placeholder:text-zinc-400 dark:placeholder:text-[#737373] focus-visible:ring-zinc-400 dark:focus-visible:ring-[#A3A3A3] transition-colors"
            />
          </label>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-44 animate-pulse rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-100 dark:bg-[#2C2D2F]" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-transparent px-6 py-14 text-center">
              <Sparkles className="h-6 w-6 text-zinc-400 dark:text-[#A3A3A3]" />
              <p className="mt-3 text-base font-medium text-zinc-700 dark:text-[#D9D9D9]">还没有项目</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-[#737373]">先创建一个空白项目，开始搭建你的图像工作流。</p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((project) => (
                <Card
                  key={project.projectId}
                  className="group overflow-hidden rounded-2xl border border-zinc-200 dark:border-[#4A4C4D] bg-white dark:bg-[#2C2D2F] p-0 text-zinc-900 dark:text-zinc-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:border-[#737373]"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/infinite-canvas/editor/${project.projectId}`)}
                    className="w-full text-left"
                  >
                    <div className="relative h-28 w-full border-b border-zinc-100 dark:border-[#161616] bg-zinc-100 dark:bg-[#161616]">
                      {project.lastOutputPreview ? (
                        <Image
                          src={project.lastOutputPreview}
                          alt={project.projectName}
                          fill
                          className="object-cover opacity-85"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : null}
                    </div>
                  </button>

                  <div className="space-y-3 px-4 py-4">
                    <div>
                      <p className="truncate text-base font-semibold text-zinc-900 dark:text-[#D9D9D9]">{project.projectName}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-[#737373]">
                        <span>{project.nodeCount} 个节点</span>
                        <span>更新于 {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 rounded-lg border border-zinc-200 dark:border-[#4A4C4D] bg-zinc-50 dark:bg-[#161616] text-xs text-zinc-700 dark:text-[#D9D9D9] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D]"
                        onClick={() => router.push(`/infinite-canvas/editor/${project.projectId}`)}
                      >
                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                        打开
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
                          onClick={() => handleRename(project)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-zinc-500 dark:text-[#A3A3A3] hover:bg-zinc-100 dark:hover:bg-[#4A4C4D] hover:text-zinc-900 dark:hover:text-[#D9D9D9]"
                          onClick={() => handleDuplicate(project.projectId)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-500/15"
                          onClick={() => handleDelete(project)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
