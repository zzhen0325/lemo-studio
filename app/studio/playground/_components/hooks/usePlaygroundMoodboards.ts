'use client';

import React from 'react';

import { formatImageUrl, getApiBase } from '@/lib/api-base';
import { usePlaygroundAvailableModels } from '@studio/playground/_components/hooks/useGenerationService';
import {
  buildRuntimeMoodboardCards,
  extractMoodboardCardEntries,
  mergeMoodboardCards,
  type MoodboardCardEntry,
  type PersistedMoodboardCardRecord,
} from '@/config/moodboard-cards';

interface UsePlaygroundMoodboardsOptions {
  initializeMoodboards?: boolean;
}

let moodboardCardRecordsCache: PersistedMoodboardCardRecord[] | null = null;
let moodboardCardRecordsPromise: Promise<PersistedMoodboardCardRecord[]> | null = null;
const moodboardCardRecordsSubscribers = new Set<(records: PersistedMoodboardCardRecord[]) => void>();
const preloadedMoodboardImageUrls = new Set<string>();

function publishMoodboardCardRecords(records: PersistedMoodboardCardRecord[]) {
  moodboardCardRecordsSubscribers.forEach((subscriber) => {
    try {
      subscriber(records);
    } catch (error) {
      console.error('[usePlaygroundMoodboards] Failed to notify subscriber', error);
    }
  });
}

async function fetchEnabledMoodboardCards(): Promise<PersistedMoodboardCardRecord[]> {
  const response = await fetch(`${getApiBase()}/moodboard-cards?enabled=true`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch moodboard cards: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function usePlaygroundMoodboards(options: UsePlaygroundMoodboardsOptions = {}) {
  const shouldInitializeMoodboards = options.initializeMoodboards ?? true;
  const availableModels = usePlaygroundAvailableModels();

  const [persistedMoodboardCards, setPersistedMoodboardCards] = React.useState<PersistedMoodboardCardRecord[]>(
    () => moodboardCardRecordsCache || [],
  );
  const [isLoadingMoodboardCards, setIsLoadingMoodboardCards] = React.useState(
    () => moodboardCardRecordsCache === null,
  );
  const [hasResolvedInitialMoodboardCards, setHasResolvedInitialMoodboardCards] = React.useState(
    () => !shouldInitializeMoodboards || moodboardCardRecordsCache !== null,
  );

  React.useEffect(() => {
    const subscriber = (records: PersistedMoodboardCardRecord[]) => {
      setPersistedMoodboardCards(records);
      setHasResolvedInitialMoodboardCards(true);
      setIsLoadingMoodboardCards(false);
    };

    moodboardCardRecordsSubscribers.add(subscriber);
    return () => {
      moodboardCardRecordsSubscribers.delete(subscriber);
    };
  }, []);

  const refreshMoodboardCards = React.useCallback(async () => {
    setIsLoadingMoodboardCards(true);
    try {
      if (!moodboardCardRecordsPromise) {
        moodboardCardRecordsPromise = fetchEnabledMoodboardCards();
      }
      const data = await moodboardCardRecordsPromise;
      moodboardCardRecordsCache = data;
      setPersistedMoodboardCards(data);
      publishMoodboardCardRecords(data);
    } catch (error) {
      console.error('[usePlaygroundMoodboards] Failed to fetch moodboard cards', error);
      if (moodboardCardRecordsCache === null) {
        setPersistedMoodboardCards([]);
        publishMoodboardCardRecords([]);
      }
    } finally {
      moodboardCardRecordsPromise = null;
      setHasResolvedInitialMoodboardCards(true);
      setIsLoadingMoodboardCards(false);
    }
  }, []);

  const invalidateAndRefreshMoodboardCards = React.useCallback(async () => {
    moodboardCardRecordsCache = null;
    moodboardCardRecordsPromise = null;
    await refreshMoodboardCards();
  }, [refreshMoodboardCards]);

  React.useEffect(() => {
    if (!shouldInitializeMoodboards) {
      setIsLoadingMoodboardCards(false);
      setHasResolvedInitialMoodboardCards(true);
      return;
    }

    if (moodboardCardRecordsCache !== null) {
      setPersistedMoodboardCards(moodboardCardRecordsCache);
      setIsLoadingMoodboardCards(false);
      setHasResolvedInitialMoodboardCards(true);
      return;
    }

    void refreshMoodboardCards();
  }, [refreshMoodboardCards, shouldInitializeMoodboards]);

  const modelLabelById = React.useMemo(() => {
    return new Map(availableModels.map((model) => [model.id, model.displayName]));
  }, [availableModels]);

  const moodboardCards = React.useMemo(() => {
    if (
      shouldInitializeMoodboards
      && !hasResolvedInitialMoodboardCards
      && moodboardCardRecordsCache === null
    ) {
      // 首轮线上数据未返回前，不先渲染本地兜底卡片，避免闪切。
      return [];
    }

    return buildRuntimeMoodboardCards({
      persistedShortcuts: persistedMoodboardCards,
      modelLabelById,
    });
  }, [hasResolvedInitialMoodboardCards, modelLabelById, persistedMoodboardCards, shouldInitializeMoodboards]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !hasResolvedInitialMoodboardCards) {
      return;
    }

    moodboardCards.forEach((moodboardCard) => {
      moodboardCard.imagePaths.forEach((rawPath) => {
        const path = typeof rawPath === 'string' ? rawPath.trim() : '';
        if (!path || path.startsWith('local:')) {
          return;
        }

        const imageSrc = formatImageUrl(path);
        if (!imageSrc || preloadedMoodboardImageUrls.has(imageSrc)) {
          return;
        }

        preloadedMoodboardImageUrls.add(imageSrc);
        const image = new window.Image();
        image.decoding = 'async';
        image.src = imageSrc;
      });
    });
  }, [hasResolvedInitialMoodboardCards, moodboardCards]);

  const moodboards = React.useMemo(() => mergeMoodboardCards([], moodboardCards), [moodboardCards]);

  const moodboardCardByCode = React.useMemo(() => {
    return new Map(moodboardCards.map((moodboardCard) => [moodboardCard.id, moodboardCard]));
  }, [moodboardCards]);

  const moodboardCardEntries = React.useMemo<MoodboardCardEntry[]>(() => {
    return extractMoodboardCardEntries(moodboards, moodboardCards);
  }, [moodboards, moodboardCards]);

  return {
    moodboardCards,
    moodboards,
    moodboardCardEntries,
    moodboardCardByCode,
    refreshMoodboardCards: invalidateAndRefreshMoodboardCards,
    isLoadingMoodboardCards,
    hasResolvedInitialMoodboardCards,
  };
}
