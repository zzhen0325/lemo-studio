import type { RefObject } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  InfiniteCanvasAsset,
  InfiniteCanvasHistoryItem,
  InfiniteCanvasProject,
} from '@/types/infinite-canvas';
import type { InfinitePanel } from '../_lib/constants';
import { EDITOR_SIDE_PANEL_CLASS, formatEtaLabel } from './infinite-canvas-editor-helpers';
import InfiniteCanvasProjectSidebar from './InfiniteCanvasProjectSidebar';

interface CanvasSidebarPanelsProps {
  projectSidebarOpen: boolean;
  projectSidebarLeft: number;
  activePanel: InfinitePanel | null;
  sidePanelLeft: number;
  project: InfiniteCanvasProject;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelectProject: (projectId: string) => void;
  onUploadAssets: (files: FileList | null) => void;
  onInsertAsset: (asset: InfiniteCanvasAsset) => void;
  onInsertHistory: (item: InfiniteCanvasHistoryItem) => void;
  onCreateNodeAtCenter: (nodeType: 'text' | 'image') => void;
  onRetryQueueItem: (nodeId: string) => void;
}

export default function CanvasSidebarPanels({
  projectSidebarOpen,
  projectSidebarLeft,
  activePanel,
  sidePanelLeft,
  project,
  fileInputRef,
  onSelectProject,
  onUploadAssets,
  onInsertAsset,
  onInsertHistory,
  onCreateNodeAtCenter,
  onRetryQueueItem,
}: CanvasSidebarPanelsProps) {
  return (
    <>
      {projectSidebarOpen ? (
        <section
          data-panel
          className={EDITOR_SIDE_PANEL_CLASS}
          style={{ left: projectSidebarLeft }}
        >
          <InfiniteCanvasProjectSidebar
            activeProjectId={project.projectId}
            onSelectProject={onSelectProject}
          />
        </section>
      ) : null}

      {activePanel ? (
        <section
          data-panel
          className={EDITOR_SIDE_PANEL_CLASS}
          style={{ left: sidePanelLeft }}
        >
          {activePanel === 'assets' ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-studio-border px-4 py-3">
                <p className="text-sm font-semibold text-studio-foreground">Assets</p>
                <Button size="sm" className="studio-action-button h-8 rounded-lg" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />上传
                </Button>
                <input
                  ref={fileInputRef as RefObject<HTMLInputElement>}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    onUploadAssets(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {project.assets.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-studio-border bg-studio-surface-muted/60 p-3 text-xs text-studio-subtle">暂无素材，上传后可一键插入画布。</p>
                ) : (
                  project.assets.map((asset) => (
                    <div key={asset.assetId} className="rounded-xl border border-studio-border bg-studio-surface-muted p-2">
                      <div className="relative h-24 w-full overflow-hidden rounded-lg border border-studio-surface-muted bg-studio-surface-strong dark:border-studio-canvas dark:bg-studio-canvas/40">
                        <Image src={asset.thumbnailUrl || asset.url} alt={asset.name} fill sizes="300px" className="object-cover" unoptimized />
                      </div>
                      <p className="mt-2 truncate text-xs text-studio-foreground">{asset.name}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="studio-secondary-button mt-2 h-7 w-full rounded-lg text-xs"
                        onClick={() => onInsertAsset(asset)}
                      >
                        插入画布
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activePanel === 'history' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-studio-border px-4 py-3">
                <p className="text-sm font-semibold text-studio-foreground">Generation History</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {project.history.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-studio-border bg-studio-surface-muted/60 p-3 text-xs text-studio-subtle">暂无历史生成结果。</p>
                ) : (
                  project.history.map((item) => (
                    <div key={item.historyId} className="rounded-xl border border-studio-border bg-studio-surface-muted p-2">
                      {item.outputUrl ? (
                        <div className="relative h-24 w-full overflow-hidden rounded-lg border border-studio-surface-muted bg-studio-surface-strong dark:border-studio-canvas dark:bg-studio-canvas/40">
                          <Image src={item.outputUrl} alt="history" fill sizes="300px" className="object-cover" unoptimized />
                        </div>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-[11px] text-studio-muted">{item.promptSnapshot || '无 Prompt 快照'}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="studio-secondary-button mt-2 h-7 w-full rounded-lg text-xs"
                        onClick={() => onInsertHistory(item)}
                      >
                        继续编辑
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activePanel === 'flows' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-studio-border px-4 py-3">
                <p className="text-sm font-semibold text-studio-foreground">Flows Library</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs text-studio-muted">
                <div className="rounded-lg border border-studio-accent/20 bg-studio-accent/10 p-3">
                  <span className="text-studio-foreground">模板能力为 P1，当前提供快捷创建：</span>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="studio-action-button h-7 rounded-lg" onClick={() => onCreateNodeAtCenter('text')}>
                      Text 模板
                    </Button>
                    <Button size="sm" className="studio-action-button h-7 rounded-lg" onClick={() => onCreateNodeAtCenter('image')}>
                      Image 模板
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activePanel === 'queue' ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-studio-border px-4 py-3">
                <p className="text-sm font-semibold text-studio-foreground">Run Queue</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {project.runQueue.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-studio-border bg-studio-surface-muted/60 p-3 text-xs text-studio-subtle">暂无任务。</p>
                ) : (
                  project.runQueue.map((item) => {
                    const progress = Math.max(0, Math.min(1, item.progress ?? (item.status === 'success' ? 1 : 0)));
                    const progressPercent = Math.round(progress * 100);
                    const showProgress = item.status === 'running' || item.status === 'success';

                    return (
                      <div key={item.queueId} className="rounded-lg border border-studio-border bg-studio-surface-muted p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-studio-foreground">{item.nodeTitle}</p>
                          <span className="rounded border border-studio-border px-1.5 py-0.5 text-[10px] uppercase text-studio-muted">{item.status}</span>
                        </div>

                        {showProgress ? (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-studio-muted">
                              <span>{progressPercent}%</span>
                              <span>ETA {formatEtaLabel(item.etaSeconds)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-studio-surface">
                              <div
                                className="h-full rounded-full bg-studio-accent"
                                style={{ width: `${Math.max(4, progressPercent)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {item.errorMsg ? <p className="mt-1 text-rose-500 dark:text-rose-400">{item.errorMsg}</p> : null}
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="studio-secondary-button h-6 rounded-md px-2 text-[10px]"
                            onClick={() => onRetryQueueItem(item.nodeId)}
                          >
                            重试
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
