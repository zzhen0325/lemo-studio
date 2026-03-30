import * as React from 'react';
import type { Generation } from '@/types/database';
import type { GroupedHistoryItem } from '@studio/playground/_components/history/types';
import {
  getOptimizationVariantOrder,
  getPromptHistoryRecordType,
  getPromptOptimizationSource,
  IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE,
  PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE,
} from '@/app/studio/playground/_lib/prompt-history';

export function getHistorySourceUrls(result: Generation): string[] {
  return result.config?.sourceImageUrls || (result.config?.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
}

export function isTextHistoryResult(result: Generation): boolean {
  if (getPromptHistoryRecordType(result.config) === IMAGE_DESCRIPTION_HISTORY_RECORD_TYPE) {
    return true;
  }

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
      const recordType = getPromptHistoryRecordType(result.config);
      const optimizationSource = getPromptOptimizationSource(result.config);
      const type: GroupedHistoryItem['type'] = recordType === PROMPT_OPTIMIZATION_HISTORY_RECORD_TYPE
        ? 'optimization'
        : isTextHistoryResult(result)
          ? 'text'
          : 'image';
      const taskId = result.config?.taskId;
      const key = taskId ? `task|${taskId}` : `item|${result.id}`;
      const existing = map.get(key);

      if (existing) {
        existing.items.push(result);
        if (!existing.originalPrompt && optimizationSource?.originalPrompt) {
          existing.originalPrompt = optimizationSource.originalPrompt;
        }
        if (!existing.optimizationSource && optimizationSource) {
          existing.optimizationSource = optimizationSource;
        }
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
          originalPrompt: optimizationSource?.originalPrompt,
          optimizationSource,
        });
      }
    });

    return Array.from(map.values())
      .map((group) => {
        if (group.type === 'optimization') {
          group.items.sort((a, b) => getOptimizationVariantOrder(a) - getOptimizationVariantOrder(b));
        }
        return group;
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [history]);
}
