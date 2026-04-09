import type { Generation } from '@/types/database';

function getHistoryItemTimestamp(item: Pick<Generation, 'createdAt'>) {
  const timestamp = new Date(item.createdAt || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getHistoryItemKey(item: Pick<Generation, 'id' | 'createdAt' | 'outputUrl'>) {
  const normalizedId = item.id?.trim();
  if (normalizedId) {
    return normalizedId;
  }

  return `${item.createdAt || 'unknown'}|${item.outputUrl || ''}`;
}

export function dedupeHistoryItems<T extends Pick<Generation, 'id' | 'createdAt' | 'outputUrl'>>(
  items: T[],
) {
  const seenKeys = new Set<string>();
  const deduped: T[] = [];

  items.forEach((item) => {
    const key = getHistoryItemKey(item);
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    deduped.push(item);
  });

  return deduped;
}

export function mergeDisplayHistoryItems({
  optimisticItems,
  serverItems,
}: {
  optimisticItems: Generation[];
  serverItems: Generation[];
}) {
  const dedupedOptimisticItems = dedupeHistoryItems(optimisticItems);
  const dedupedServerItems = dedupeHistoryItems(serverItems);
  const mergedItems = [...dedupedOptimisticItems];
  const mergedIndexes = new Map<string, number>();

  mergedItems.forEach((item, index) => {
    mergedIndexes.set(getHistoryItemKey(item), index);
  });

  dedupedServerItems.forEach((item) => {
    const key = getHistoryItemKey(item);
    const existingIndex = mergedIndexes.get(key);

    if (typeof existingIndex === 'number') {
      mergedItems[existingIndex] = item;
      return;
    }

    mergedIndexes.set(key, mergedItems.length);
    mergedItems.push(item);
  });

  return mergedItems.sort((left, right) => (
    getHistoryItemTimestamp(right) - getHistoryItemTimestamp(left)
  ));
}

export function upsertHistoryItems(
  previousItems: Generation[],
  nextItems: Generation[],
) {
  const nextItemsByKey = new Map(
    nextItems.map((item) => [getHistoryItemKey(item), item]),
  );
  const remainingPreviousItems = previousItems.filter(
    (item) => !nextItemsByKey.has(getHistoryItemKey(item)),
  );

  return dedupeHistoryItems([...nextItems, ...remainingPreviousItems]);
}

export function removeHistoryItemsById(
  previousItems: Generation[],
  ids: string[],
) {
  if (ids.length === 0) {
    return previousItems;
  }

  const idSet = new Set(ids);
  return previousItems.filter((item) => !idSet.has(item.id));
}
