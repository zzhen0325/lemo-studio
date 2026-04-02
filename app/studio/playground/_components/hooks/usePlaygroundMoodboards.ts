'use client';

import React from 'react';

import { getApiBase } from '@/lib/api-base';
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

  const refreshMoodboardCards = React.useCallback(async () => {
    setIsLoadingMoodboardCards(true);
    try {
      if (!moodboardCardRecordsPromise) {
        moodboardCardRecordsPromise = fetchEnabledMoodboardCards();
      }
      const data = await moodboardCardRecordsPromise;
      moodboardCardRecordsCache = data;
      setPersistedMoodboardCards(data);
    } catch (error) {
      console.error('[usePlaygroundMoodboards] Failed to fetch moodboard cards', error);
      if (moodboardCardRecordsCache === null) {
        setPersistedMoodboardCards([]);
      }
    } finally {
      moodboardCardRecordsPromise = null;
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
      return;
    }

    if (moodboardCardRecordsCache) {
      setPersistedMoodboardCards(moodboardCardRecordsCache);
      setIsLoadingMoodboardCards(false);
      return;
    }

    void refreshMoodboardCards();
  }, [refreshMoodboardCards, shouldInitializeMoodboards]);

  const modelLabelById = React.useMemo(() => {
    return new Map(availableModels.map((model) => [model.id, model.displayName]));
  }, [availableModels]);

  const moodboardCards = React.useMemo(() => {
    return buildRuntimeMoodboardCards({
      persistedShortcuts: persistedMoodboardCards,
      modelLabelById,
    });
  }, [modelLabelById, persistedMoodboardCards]);

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
  };
}
