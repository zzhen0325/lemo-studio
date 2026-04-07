import { describe, expect, it } from 'vitest';

import {
  buildStableGalleryColumns,
  sortGalleryItems,
} from '@/app/studio/playground/_components/gallery/gallery-layout';
import type { Generation } from '@/types/database';

function createGeneration(id: string, createdAt: string): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/${id}.png`,
    status: 'completed',
    createdAt,
    config: {
      prompt: `Prompt ${id}`,
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
    },
  };
}

describe('gallery-layout stable columns', () => {
  it('keeps existing items in their original columns when new items are prepended', () => {
    const baseItems = [
      createGeneration('a', '2026-04-07T12:00:06.000Z'),
      createGeneration('b', '2026-04-07T12:00:05.000Z'),
      createGeneration('c', '2026-04-07T12:00:04.000Z'),
      createGeneration('d', '2026-04-07T12:00:03.000Z'),
      createGeneration('e', '2026-04-07T12:00:02.000Z'),
      createGeneration('f', '2026-04-07T12:00:01.000Z'),
    ];

    const initial = buildStableGalleryColumns(sortGalleryItems(baseItems), 3, 'recent');
    const initialColumnsById = Object.fromEntries(
      initial.entries.map((entry) => [entry.item.id, entry.columnIndex]),
    );

    const prependedItems = [
      createGeneration('x', '2026-04-07T12:00:08.000Z'),
      createGeneration('y', '2026-04-07T12:00:07.000Z'),
      ...baseItems,
    ];
    const next = buildStableGalleryColumns(
      sortGalleryItems(prependedItems),
      3,
      'recent',
      initial.state,
    );

    expect(next.entries.find((entry) => entry.item.id === 'x')?.columnIndex).toBe(0);
    expect(next.entries.find((entry) => entry.item.id === 'y')?.columnIndex).toBe(1);

    for (const item of baseItems) {
      expect(next.entries.find((entry) => entry.item.id === item.id)?.columnIndex).toBe(
        initialColumnsById[item.id],
      );
    }
  });

  it('rebuilds columns from scratch when the layout key changes', () => {
    const baseItems = [
      createGeneration('a', '2026-04-07T12:00:03.000Z'),
      createGeneration('b', '2026-04-07T12:00:02.000Z'),
      createGeneration('c', '2026-04-07T12:00:01.000Z'),
    ];

    const initial = buildStableGalleryColumns(sortGalleryItems(baseItems), 3, 'recent');
    const filteredItems = [baseItems[2], baseItems[0]];

    const rebuilt = buildStableGalleryColumns(
      sortGalleryItems(filteredItems),
      3,
      'recent|filtered',
      initial.state,
    );

    expect(rebuilt.state.layoutKey).toBe('recent|filtered');
    expect(rebuilt.entries.map((entry) => `${entry.item.id}:${entry.columnIndex}`)).toEqual([
      'a:0',
      'c:1',
    ]);
  });
});
