"use client";

import { useAuthStore } from '@/lib/store/auth-store';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import type { SortBy } from '@/lib/server/service/history.service';
import type { Generation } from '@/types/database';
import { getApiBase } from '@/lib/api-base';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import useSWRInfinite from 'swr/infinite';
import { buildGalleryFilterOptions, resolveGalleryItems } from './resolve-gallery-item';
import type { GalleryFeedPage, GalleryFeedResult } from './types';
import { dedupeHistoryItems, mergeDisplayHistoryItems } from '@/lib/history-utils';

const GALLERY_PAGE_LIMIT = 24;
const GALLERY_SYNC_THROTTLE_MS = 15_000;

async function fetchGalleryFeedPage(
  page: number,
  sortBy: SortBy,
  viewerUserId?: string,
): Promise<GalleryFeedPage> {
  const url = new URL(`${getApiBase()}/history`, window.location.origin);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(GALLERY_PAGE_LIMIT));
  url.searchParams.set('lightweight', '1');
  url.searchParams.set('minimal', '1');
  url.searchParams.set('sortBy', sortBy);

  if (viewerUserId) {
    url.searchParams.set('viewerUserId', viewerUserId);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch gallery feed');
  }

  const data = await response.json();

  return {
    history: Array.isArray(data.history) ? data.history as Generation[] : [],
    hasMore: Boolean(data.hasMore),
    total: typeof data.total === 'number' ? data.total : undefined,
  };
}

function buildGalleryFeedRequestUrl(
  page: number,
  sortBy: SortBy,
  viewerUserId?: string,
) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(GALLERY_PAGE_LIMIT));
  params.set('lightweight', '1');
  params.set('minimal', '1');
  params.set('sortBy', sortBy);

  if (viewerUserId) {
    params.set('viewerUserId', viewerUserId);
  }

  return `${getApiBase()}/history?${params.toString()}`;
}

function createGalleryFeedKey(
  pageIndex: number,
  previousPageData: GalleryFeedPage | null,
  sortBy: SortBy,
  viewerUserId?: string,
) {
  if (previousPageData && !previousPageData.hasMore) {
    return null;
  }

  return buildGalleryFeedRequestUrl(pageIndex + 1, sortBy, viewerUserId);
}

export function getGalleryFeedLoadingState({
  data,
  error,
  isValidating,
  size,
}: {
  data?: GalleryFeedPage[];
  error?: unknown;
  isValidating: boolean;
  size: number;
}) {
  const hasSettledFirstRequest = Boolean(data) || Boolean(error);
  const isInitialLoading = !hasSettledFirstRequest && isValidating;
  const isLoadingMore = Boolean(data && size > data.length && isValidating);
  const isRefreshing = Boolean(data && data.length > 0 && isValidating && !isLoadingMore);

  return {
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
  };
}

export function useGalleryFeed({
  sortBy,
}: {
  sortBy: Exclude<SortBy, 'interactionPriority'>;
}): GalleryFeedResult {
  const actorId = useAuthStore((state) => state.actorId);
  const ensureSession = useAuthStore((state) => state.ensureSession);
  const optimisticHistory = usePlaygroundStore((state) => state.generationHistory);
  const lastLatestSyncAtRef = useRef<number | null>(null);

  useEffect(() => {
    void ensureSession().catch(() => undefined);
  }, [ensureSession]);

  const {
    data,
    error,
    size,
    setSize,
    isValidating,
    mutate,
  } = useSWRInfinite<GalleryFeedPage>(
    (pageIndex, previousPageData) => createGalleryFeedKey(pageIndex, previousPageData, sortBy, actorId || undefined),
    async (requestUrl) => {
      const pageParam = new URL(requestUrl, window.location.origin).searchParams.get('page');
      const page = Number(pageParam) || 1;
      return fetchGalleryFeedPage(page, sortBy, actorId || undefined);
    },
    {
      revalidateOnFocus: true,
      revalidateFirstPage: false,
      persistSize: true,
      keepPreviousData: true,
      revalidateIfStale: true,
      dedupingInterval: 5_000,
      focusThrottleInterval: 10_000,
    },
  );

  const pages = data || [];
  const serverHistoryItems = useMemo(
    () => dedupeHistoryItems(pages.flatMap((page) => page.history)),
    [pages],
  );
  const historyItems = useMemo(
    () => mergeDisplayHistoryItems({
      optimisticItems: optimisticHistory,
      serverItems: serverHistoryItems,
    }),
    [optimisticHistory, serverHistoryItems],
  );
  const resolvedItems = useMemo(() => resolveGalleryItems(historyItems), [historyItems]);
  const items = useMemo(() => resolvedItems.filter((item) => item.isImageVisible), [resolvedItems]);
  const promptItems = useMemo(() => resolvedItems.filter((item) => item.isPromptVisible), [resolvedItems]);
  const filterOptions = useMemo(() => buildGalleryFilterOptions(resolvedItems), [resolvedItems]);

  const {
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
  } = getGalleryFeedLoadingState({
    data,
    error,
    isValidating,
    size,
  });
  const hasMore = pages.length > 0 ? pages[pages.length - 1]?.hasMore ?? true : true;

  const loadMore = useCallback(async () => {
    if (isValidating || !hasMore) {
      return;
    }
    await setSize((current) => current + 1);
  }, [hasMore, isValidating, setSize]);

  const revalidateLatest = useCallback(async () => {
    if (historyItems.length === 0) {
      return;
    }

    const now = Date.now();
    if (lastLatestSyncAtRef.current && now - lastLatestSyncAtRef.current < GALLERY_SYNC_THROTTLE_MS) {
      return;
    }

    const latestPage = await fetchGalleryFeedPage(1, sortBy, actorId || undefined);
    lastLatestSyncAtRef.current = Date.now();

    await mutate((currentPages) => {
      if (!currentPages || currentPages.length === 0) {
        return [latestPage];
      }

      const mergedHistory = dedupeHistoryItems([
        ...latestPage.history,
        ...currentPages.flatMap((page) => page.history),
      ]);

      const nextPages = currentPages.map((page, index) => {
        const start = index * GALLERY_PAGE_LIMIT;
        const end = start + GALLERY_PAGE_LIMIT;
        return {
          ...page,
          history: mergedHistory.slice(start, end),
        };
      }).filter((page, index) => index === 0 || page.history.length > 0);

      if (nextPages.length === 0) {
        return [latestPage];
      }

      const lastIndex = nextPages.length - 1;
      nextPages[lastIndex] = {
        ...nextPages[lastIndex],
        hasMore: currentPages.length > 1
          ? currentPages[lastIndex]?.hasMore ?? latestPage.hasMore
          : latestPage.hasMore,
      };

      return nextPages;
    }, { revalidate: false });
  }, [actorId, historyItems.length, mutate, sortBy]);

  return {
    items,
    promptItems,
    filterOptions,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isRefreshing,
    loadMore,
    revalidateLatest,
  };
}
