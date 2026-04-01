'use client';

import React from 'react';

import { getApiBase } from '@/lib/api-base';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { usePlaygroundAvailableModels } from '@studio/playground/_components/hooks/useGenerationService';
import {
  buildRuntimePlaygroundShortcuts,
  extractShortcutMoodboardEntries,
  getShortcutMoodboardId,
  mergeShortcutMoodboards,
  type ShortcutMoodboardEntry,
  type PersistedPlaygroundShortcutRecord,
} from '@/config/playground-shortcuts';
import type { StyleStack } from '@/types/database';

interface UsePlaygroundMoodboardsOptions {
  initializeStyles?: boolean;
}

let shortcutRecordsCache: PersistedPlaygroundShortcutRecord[] | null = null;
let shortcutRecordsPromise: Promise<PersistedPlaygroundShortcutRecord[]> | null = null;

async function fetchEnabledShortcuts(): Promise<PersistedPlaygroundShortcutRecord[]> {
  const response = await fetch(`${getApiBase()}/playground-shortcuts?enabled=true`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shortcuts: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function usePlaygroundMoodboards(options: UsePlaygroundMoodboardsOptions = {}) {
  const { initializeStyles = true } = options;
  const styles = usePlaygroundStore((state) => state.styles);
  const initStyles = usePlaygroundStore((state) => state.initStyles);
  const isStylesLoading = usePlaygroundStore((state) => state._stylesLoading);
  const areStylesLoaded = usePlaygroundStore((state) => state._stylesLoaded);
  const availableModels = usePlaygroundAvailableModels();

  const [persistedShortcuts, setPersistedShortcuts] = React.useState<PersistedPlaygroundShortcutRecord[]>(
    () => shortcutRecordsCache || [],
  );
  const [isLoadingShortcuts, setIsLoadingShortcuts] = React.useState(() => shortcutRecordsCache === null);

  const refreshShortcuts = React.useCallback(async () => {
    setIsLoadingShortcuts(true);
    try {
      if (!shortcutRecordsPromise) {
        shortcutRecordsPromise = fetchEnabledShortcuts();
      }
      const data = await shortcutRecordsPromise;
      shortcutRecordsCache = data;
      setPersistedShortcuts(data);
    } catch (error) {
      console.error('[usePlaygroundMoodboards] Failed to fetch shortcuts', error);
      if (shortcutRecordsCache === null) {
        setPersistedShortcuts([]);
      }
    } finally {
      shortcutRecordsPromise = null;
      setIsLoadingShortcuts(false);
    }
  }, []);

  const invalidateAndRefreshShortcuts = React.useCallback(async () => {
    shortcutRecordsCache = null;
    shortcutRecordsPromise = null;
    await refreshShortcuts();
  }, [refreshShortcuts]);

  React.useEffect(() => {
    if (shortcutRecordsCache) {
      setPersistedShortcuts(shortcutRecordsCache);
      setIsLoadingShortcuts(false);
      return;
    }

    void refreshShortcuts();
  }, [refreshShortcuts]);

  React.useEffect(() => {
    if (initializeStyles && !areStylesLoaded && !isStylesLoading) {
      void initStyles();
    }
  }, [areStylesLoaded, initStyles, initializeStyles, isStylesLoading]);

  const modelLabelById = React.useMemo(() => {
    return new Map(availableModels.map((model) => [model.id, model.displayName]));
  }, [availableModels]);

  const shortcuts = React.useMemo(() => {
    return buildRuntimePlaygroundShortcuts({
      persistedShortcuts,
      legacyStyles: styles,
      modelLabelById,
    });
  }, [modelLabelById, persistedShortcuts, styles]);

  const moodboards = React.useMemo(() => mergeShortcutMoodboards(styles, shortcuts), [shortcuts, styles]);

  const shortcutMoodboardsByCode = React.useMemo(() => {
    const moodboardById = new Map(moodboards.map((moodboard) => [moodboard.id, moodboard]));

    return shortcuts.reduce<Record<string, StyleStack | null>>((acc, shortcut) => {
      acc[shortcut.id] = moodboardById.get(getShortcutMoodboardId(shortcut.id)) || null;
      return acc;
    }, {});
  }, [moodboards, shortcuts]);

  const shortcutByCode = React.useMemo(() => {
    return new Map(shortcuts.map((shortcut) => [shortcut.id, shortcut]));
  }, [shortcuts]);

  const shortcutMoodboardEntries = React.useMemo<ShortcutMoodboardEntry[]>(() => {
    return extractShortcutMoodboardEntries(moodboards, shortcuts);
  }, [moodboards, shortcuts]);

  return {
    rawStyles: styles,
    shortcuts,
    moodboards,
    shortcutMoodboardEntries,
    shortcutMoodboardsByCode,
    shortcutByCode,
    refreshShortcuts: invalidateAndRefreshShortcuts,
    isLoadingShortcuts,
  };
}
