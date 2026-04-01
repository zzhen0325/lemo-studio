import { describe, expect, it } from 'vitest';
import { migrateTldrawSnapshot } from '@/components/image-editor/utils/migrate-tldraw-snapshot';

describe('migrateTldrawSnapshot', () => {
  it('migrates valid annotation records into image editor session', () => {
    const session = migrateTldrawSnapshot({
      store: {
        a1: {
          id: 'shape:1',
          typeName: 'shape',
          type: 'annotation',
          x: 12,
          y: 20,
          props: {
            w: 180,
            h: 96,
            name: '区域02',
            content: '替换局部背景为海边',
          },
        },
        a2: {
          id: 'shape:2',
          typeName: 'shape',
          type: 'annotation',
          x: 260,
          y: 80,
          props: {
            w: 120,
            h: 100,
            name: '区域01',
            content: '增强人物光影',
          },
        },
      },
    }, {
      imageWidth: 1024,
      imageHeight: 768,
      plainPrompt: '保留主体构图',
    });

    expect(session).toBeDefined();
    expect(session?.plainPrompt).toBe('保留主体构图');
    expect(session?.annotations).toHaveLength(2);
    expect(session?.annotations[0].label).toBe('标注01');
    expect(session?.annotations[0].description).toBe('增强人物光影');
    expect(session?.annotations[1].label).toBe('标注02');
  });

  it('is tolerant to missing fields and returns undefined when no valid annotation', () => {
    const session = migrateTldrawSnapshot({
      store: {
        bad1: {
          typeName: 'shape',
          type: 'annotation',
          x: 10,
          y: 20,
          props: { w: 0, h: 20 },
        },
        bad2: {
          typeName: 'shape',
          type: 'annotation',
          x: 'a',
          y: 20,
          props: { w: 100, h: 50 },
        },
      },
    });

    expect(session).toBeUndefined();
  });

  it('filters non-annotation shapes', () => {
    const session = migrateTldrawSnapshot({
      store: {
        text1: {
          typeName: 'shape',
          type: 'text',
          x: 0,
          y: 0,
          props: { text: 'ignored' },
        },
        image1: {
          typeName: 'shape',
          type: 'image',
          x: 0,
          y: 0,
          props: { w: 100, h: 100 },
        },
      },
    });

    expect(session).toBeUndefined();
  });
});
