"use client";

import { useMemo, useState } from 'react';
import { GalleryScene } from '@/components/gallery/GalleryScene';
import { buildGalleryFilterOptions } from '@/lib/gallery/resolve-gallery-item';
import type { GalleryActionHandlers, GalleryFeedResult, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import type { SortBy } from '@/lib/server/service/history.service';

const noop = () => undefined;
const noopAsync = async () => undefined;

const fixtureActions: GalleryActionHandlers = {
  onSelectItem: noop,
  onUsePrompt: noop,
  onUseImage: noopAsync,
  onRerun: noopAsync,
  onDownload: (_item, downloadUrl) => {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  },
};

const fixtureMoodboardData: GalleryMoodboardData = {
  moodboards: [],
  moodboardCards: [],
  refreshMoodboardCards: noopAsync,
};

export default function GalleryLocalFixtureClient({
  items,
}: {
  items: GalleryItemViewModel[];
}) {
  const [sortBy, setSortBy] = useState<Exclude<SortBy, 'interactionPriority'>>('recent');

  const feed = useMemo<GalleryFeedResult>(() => ({
    items,
    promptItems: items.filter((item) => item.isPromptVisible),
    filterOptions: buildGalleryFilterOptions(items),
    hasMore: false,
    isInitialLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
    loadMore: noopAsync,
    revalidateLatest: noopAsync,
  }), [items]);

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-hidden bg-black">
      <div className="relative z-30 flex min-h-0 min-w-0 w-full flex-1 overflow-hidden pl-20 md:pl-28 lg:pl-28">
        <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          <GalleryScene
            feed={feed}
            isActive
            sortBy={sortBy}
            onSortByChange={setSortBy}
            actions={fixtureActions}
            moodboardData={fixtureMoodboardData}
          />
        </div>
      </div>
    </div>
  );
}
