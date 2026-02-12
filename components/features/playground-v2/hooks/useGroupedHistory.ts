import * as React from 'react';
import type { Generation } from '@/types/database';
import type { GroupedHistoryItem } from '@/components/features/playground-v2/history/types';

export function getHistorySourceUrls(result: Generation): string[] {
  return result.config?.sourceImageUrls || (result.config?.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
}

export function isTextHistoryResult(result: Generation): boolean {
  const sourceUrls = getHistorySourceUrls(result);
  const firstSourceUrl = sourceUrls[0];
  return !!firstSourceUrl && result.outputUrl === firstSourceUrl;
}

export function useGroupedHistory(history: Generation[]): GroupedHistoryItem[] {
  return React.useMemo(() => {
    const map = new Map<string, GroupedHistoryItem>();

    history.forEach((result) => {
      const sourceUrls = getHistorySourceUrls(result);
      const firstSourceUrl = sourceUrls[0];
      const type: 'image' | 'text' = isTextHistoryResult(result) ? 'text' : 'image';
      const taskId = result.config?.taskId;
      const key = taskId ? `task|${taskId}` : `item|${result.id}`;
      const existing = map.get(key);

      if (existing) {
        existing.items.push(result);
        if (new Date(result.createdAt).getTime() < new Date(existing.startAt).getTime()) {
          existing.startAt = result.createdAt;
        }
      } else {
        map.set(key, {
          type,
          key,
          items: [result],
          sourceImage: type === 'text' ? firstSourceUrl : undefined,
          startAt: result.createdAt,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [history]);
}
