"use client";

import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeGrid as Grid, type GridChildComponentProps } from 'react-window';
import type { GalleryActionHandlers, GalleryItemViewModel } from '@/lib/gallery/types';

const PROMPT_CARD_HEIGHT = 280;
const PROMPT_GRID_GAP = 16;

function getPromptColumnCount(width: number) {
  if (width >= 1280) return 3;
  if (width >= 840) return 2;
  return 1;
}

interface PromptGridData {
  items: GalleryItemViewModel[];
  actions: GalleryActionHandlers;
  columnCount: number;
}

function PromptCardCell({ columnIndex, rowIndex, style, data }: GridChildComponentProps<PromptGridData>) {
  const itemIndex = rowIndex * data.columnCount + columnIndex;
  const item = data.items[itemIndex];

  if (!item) {
    return null;
  }

  return (
    <div
      style={{
        ...style,
        left: Number(style.left) + PROMPT_GRID_GAP / 2,
        top: Number(style.top) + PROMPT_GRID_GAP / 2,
        width: Number(style.width) - PROMPT_GRID_GAP,
        height: Number(style.height) - PROMPT_GRID_GAP,
      }}
    >
      <button
        type="button"
        onClick={() => data.actions.onUsePrompt(item.raw)}
        className="group flex h-full w-full flex-col rounded-2xl border border-white/10 bg-black/20 p-5 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/65">
              {item.promptCategoryLabel}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase text-white/30">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-white/35">
          <span>{item.model || 'Unknown Model'}</span>
          {item.presetName ? <span>/ {item.presetName}</span> : null}
        </div>
        <p className="mt-4 flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/82 line-clamp-[10]">
          {item.prompt || '暂无提示词'}
        </p>
        <div className="mt-4 text-[11px] text-white/25 transition-colors group-hover:text-white/55">
          Click to use prompt
        </div>
      </button>
    </div>
  );
}

interface GalleryPromptGridProps {
  items: GalleryItemViewModel[];
  actions: GalleryActionHandlers;
}

export function GalleryPromptGrid({ items, actions }: GalleryPromptGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm text-white/35">
        No prompt records yet
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <AutoSizer>
        {({ height, width }) => {
          const columnCount = getPromptColumnCount(width);
          const columnWidth = Math.max(260, Math.floor(width / columnCount));
          const rowCount = Math.ceil(items.length / columnCount);
          const gridData: PromptGridData = { items, actions, columnCount };

          return (
            <Grid
              className="custom-scrollbar"
              columnCount={columnCount}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={PROMPT_CARD_HEIGHT + PROMPT_GRID_GAP}
              width={width}
              itemData={gridData}
            >
              {PromptCardCell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
}
