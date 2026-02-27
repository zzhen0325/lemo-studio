import { describe, expect, it } from 'vitest';
import { buildImageEditPrompt } from '@/components/image-editor';
import type { ImageEditorAnnotation } from '@/components/image-editor';

function ann(partial: Partial<ImageEditorAnnotation>): ImageEditorAnnotation {
  return {
    id: partial.id || 'a1',
    label: partial.label || '区域01',
    description: partial.description || '',
    x: partial.x || 0,
    y: partial.y || 0,
    width: partial.width || 10,
    height: partial.height || 10,
  };
}

describe('buildImageEditPrompt', () => {
  it('returns empty sections when prompt and annotations are empty', () => {
    const result = buildImageEditPrompt('', []);

    expect(result.plainPrompt).toBe('');
    expect(result.regionInstructions).toBe('');
    expect(result.finalPrompt).toBe('');
  });

  it('builds region instructions for multiple annotations', () => {
    const result = buildImageEditPrompt('保留主体并优化背景', [
      ann({ id: 'a2', label: '区域02', description: '将天空改成黄昏，增加层次' }),
      ann({ id: 'a1', label: '区域01', description: '人物皮肤更自然，增强质感' }),
    ]);

    expect(result.regionInstructions).toBe(
      'Region Instructions:\n[区域01]: 人物皮肤更自然，增强质感\n[区域02]: 将天空改成黄昏，增加层次'
    );
    expect(result.finalPrompt).toBe(
      '保留主体并优化背景\n\nRegion Instructions:\n[区域01]: 人物皮肤更自然，增强质感\n[区域02]: 将天空改成黄昏，增加层次\n\n最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。'
    );
  });

  it('throws when there is annotation without description', () => {
    expect(() => {
      buildImageEditPrompt('测试', [
        ann({ id: 'a1', label: '区域01', description: ' ' }),
      ]);
    }).toThrow('存在未填写说明的标注区域，请补充后再确认。');
  });

  it('normalizes label order and numbering', () => {
    const result = buildImageEditPrompt('test', [
      ann({ id: 'a10', label: '区域10', description: 'ten' }),
      ann({ id: 'a2', label: '区域2', description: 'two' }),
      ann({ id: 'a1', label: 'foo', description: 'one' }),
    ]);

    expect(result.orderedAnnotations.map((item) => item.label)).toEqual(['区域01', '区域02', '区域03']);
    expect(result.regionInstructions).toContain('[区域01]: two');
    expect(result.regionInstructions).toContain('[区域02]: one');
    expect(result.regionInstructions).toContain('[区域03]: ten');
    expect(result.finalPrompt).toContain('最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。');
  });
});
