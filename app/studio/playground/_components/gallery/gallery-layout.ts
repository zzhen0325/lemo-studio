import type { Generation } from '@/types/database';

export interface OrderedGalleryEntry<T extends Generation> {
  item: T;
  key: string;
  orderedIndex: number;
}

export interface GalleryColumnEntry<T extends Generation> extends OrderedGalleryEntry<T> {
  columnIndex: number;
}

export interface PositionedGalleryEntry<T extends Generation> extends GalleryColumnEntry<T> {
  height: number;
  top: number;
  left: number;
  width: number;
}

export interface StableGalleryColumnsState {
  layoutKey: string;
  columnsCount: number;
  itemKeys: string[];
  columnByKey: Record<string, number>;
  appendCursor: number;
  prependCursor: number;
}

export interface StableGalleryColumnsResult<T extends Generation> {
  entries: Array<GalleryColumnEntry<T>>;
  columns: Array<Array<GalleryColumnEntry<T>>>;
  state: StableGalleryColumnsState;
}

export interface VirtualizedGalleryLayoutResult<T extends Generation> {
  containerHeight: number;
  items: Array<PositionedGalleryEntry<T>>;
}

function toTimestamp(value?: string) {
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getGalleryItemKey(item: Generation, orderedIndex: number) {
  const normalizedId = (item.id || '').trim();
  return normalizedId || `gallery-item-${item.createdAt || 'unknown'}-${orderedIndex}`;
}

export function sortGalleryItems<T extends Generation>(items: T[]): Array<OrderedGalleryEntry<T>> {
  return items
    .map((item, index) => ({ item, originalIndex: index }))
    .sort((a, b) => {
      const createdAtDiff = toTimestamp(b.item.createdAt) - toTimestamp(a.item.createdAt);
      if (createdAtDiff !== 0) return createdAtDiff;

      const aId = (a.item.id || '').trim();
      const bId = (b.item.id || '').trim();
      if (aId && bId) {
        const idDiff = aId.localeCompare(bId);
        if (idDiff !== 0) return idDiff;
      } else if (aId) {
        return -1;
      } else if (bId) {
        return 1;
      }

      return a.originalIndex - b.originalIndex;
    })
    .map(({ item }, orderedIndex) => ({
      item,
      orderedIndex,
      key: getGalleryItemKey(item, orderedIndex),
    }));
}

function buildInitialState<T extends Generation>(
  orderedEntries: Array<OrderedGalleryEntry<T>>,
  columnsCount: number,
  layoutKey: string,
): StableGalleryColumnsResult<T> {
  const safeColumnsCount = Math.max(columnsCount, 1);
  const columnByKey: Record<string, number> = {};
  const columns = Array.from({ length: safeColumnsCount }, () => [] as Array<GalleryColumnEntry<T>>);
  const entries = orderedEntries.map((entry, orderedIndex) => {
    const columnIndex = orderedIndex % safeColumnsCount;
    columnByKey[entry.key] = columnIndex;
    const nextEntry = {
      ...entry,
      orderedIndex,
      columnIndex,
    };
    columns[columnIndex].push(nextEntry);
    return nextEntry;
  });

  return {
    entries,
    columns,
    state: {
      layoutKey,
      columnsCount: safeColumnsCount,
      itemKeys: orderedEntries.map((entry) => entry.key),
      columnByKey,
      appendCursor: entries.length % safeColumnsCount,
      prependCursor: 0,
    },
  };
}

function isStrictPrepend(unknownIndexes: number[], firstKnownIndex: number) {
  return firstKnownIndex >= 0 && unknownIndexes.every((index) => index < firstKnownIndex);
}

function isStrictAppend(unknownIndexes: number[], lastKnownIndex: number) {
  return lastKnownIndex >= 0 && unknownIndexes.every((index) => index > lastKnownIndex);
}

export function buildStableGalleryColumns<T extends Generation>(
  orderedEntries: Array<OrderedGalleryEntry<T>>,
  columnsCount: number,
  layoutKey: string,
  previousState?: StableGalleryColumnsState | null,
): StableGalleryColumnsResult<T> {
  const safeColumnsCount = Math.max(columnsCount, 1);
  if (
    !previousState ||
    previousState.layoutKey !== layoutKey ||
    previousState.columnsCount !== safeColumnsCount
  ) {
    return buildInitialState(orderedEntries, safeColumnsCount, layoutKey);
  }

  const previousKeys = previousState.itemKeys;
  const previousKeySet = new Set(previousKeys);
  const currentKeys = orderedEntries.map((entry) => entry.key);
  const unknownIndexes = currentKeys.reduce<number[]>((result, key, index) => {
    if (!previousKeySet.has(key)) result.push(index);
    return result;
  }, []);

  if (unknownIndexes.length === 0) {
    const columnByKey = currentKeys.reduce<Record<string, number>>((result, key, index) => {
      result[key] = previousState.columnByKey[key] ?? (index % safeColumnsCount);
      return result;
    }, {});
    const columns = Array.from({ length: safeColumnsCount }, () => [] as Array<GalleryColumnEntry<T>>);
    const entries = orderedEntries.map((entry, orderedIndex) => {
      const columnIndex = columnByKey[entry.key];
      const nextEntry = { ...entry, orderedIndex, columnIndex };
      columns[columnIndex].push(nextEntry);
      return nextEntry;
    });
    return {
      entries,
      columns,
      state: {
        ...previousState,
        itemKeys: currentKeys,
        columnByKey,
      },
    };
  }

  const knownIndexes = currentKeys.reduce<number[]>((result, key, index) => {
    if (previousKeySet.has(key)) result.push(index);
    return result;
  }, []);
  const firstKnownIndex = knownIndexes.length > 0 ? knownIndexes[0] : -1;
  const lastKnownIndex = knownIndexes.length > 0 ? knownIndexes[knownIndexes.length - 1] : -1;
  const treatAsPrepend = isStrictPrepend(unknownIndexes, firstKnownIndex);
  const treatAsAppend = isStrictAppend(unknownIndexes, lastKnownIndex);

  if (!treatAsPrepend && !treatAsAppend) {
    return buildInitialState(orderedEntries, safeColumnsCount, layoutKey);
  }

  let appendCursor = previousState.appendCursor;
  let prependCursor = previousState.prependCursor;
  const columnByKey = { ...previousState.columnByKey };

  orderedEntries.forEach((entry) => {
    if (columnByKey[entry.key] !== undefined) return;

    if (treatAsPrepend) {
      columnByKey[entry.key] = prependCursor % safeColumnsCount;
      prependCursor += 1;
      return;
    }

    columnByKey[entry.key] = appendCursor % safeColumnsCount;
    appendCursor += 1;
  });

  const normalizedCurrentKeys = new Set(currentKeys);
  Object.keys(columnByKey).forEach((key) => {
    if (!normalizedCurrentKeys.has(key)) {
      delete columnByKey[key];
    }
  });

  const columns = Array.from({ length: safeColumnsCount }, () => [] as Array<GalleryColumnEntry<T>>);
  const entries = orderedEntries.map((entry, orderedIndex) => {
    const columnIndex = columnByKey[entry.key] ?? (orderedIndex % safeColumnsCount);
    const nextEntry = { ...entry, orderedIndex, columnIndex };
    columns[columnIndex].push(nextEntry);
    return nextEntry;
  });

  return {
    entries,
    columns,
    state: {
      layoutKey,
      columnsCount: safeColumnsCount,
      itemKeys: currentKeys,
      columnByKey,
      appendCursor: appendCursor % safeColumnsCount,
      prependCursor: prependCursor % safeColumnsCount,
    },
  };
}

export function estimateGalleryCardHeight(item: Generation, columnWidth: number) {
  const width = Number(item.config?.width) || 1024;
  const height = Number(item.config?.height) || 1024;
  const aspectRatio = width > 0 ? height / width : 1;
  const estimatedMediaHeight = columnWidth * (Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1);
  return Math.max(estimatedMediaHeight, item.status === 'pending' ? 124 : 48);
}

export function buildVirtualizedGalleryLayout<T extends Generation>(
  columns: Array<Array<GalleryColumnEntry<T>>>,
  columnWidth: number,
  gap: number,
  measuredHeights: Map<string, number>,
  estimateHeight: (item: T, columnWidth: number) => number,
): VirtualizedGalleryLayoutResult<T> {
  const positionedItems: Array<PositionedGalleryEntry<T>> = [];
  let containerHeight = 0;

  columns.forEach((columnEntries, columnIndex) => {
    let top = 0;
    const left = columnIndex * (columnWidth + gap);

    columnEntries.forEach((entry) => {
      const height = measuredHeights.get(entry.key) ?? estimateHeight(entry.item, columnWidth);
      positionedItems.push({
        ...entry,
        height,
        top,
        left,
        width: columnWidth,
      });
      top += height + gap;
    });

    const columnHeight = columnEntries.length > 0 ? top - gap : 0;
    containerHeight = Math.max(containerHeight, columnHeight);
  });

  return {
    containerHeight,
    items: positionedItems,
  };
}

export function getVisibleVirtualizedGalleryItems<T extends Generation>(
  items: Array<PositionedGalleryEntry<T>>,
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
) {
  const visibleTop = Math.max(0, scrollTop - overscan);
  const visibleBottom = scrollTop + viewportHeight + overscan;

  return items.filter((item) => {
    const itemBottom = item.top + item.height;
    return itemBottom >= visibleTop && item.top <= visibleBottom;
  });
}
