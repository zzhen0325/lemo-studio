import { describe, expect, it } from 'vitest';
import { buildImageEditPrompt } from '@/components/image-editor/utils/build-image-edit-prompt';
import type { ImageEditorAnnotation } from '@/components/image-editor/types';
import { mergePromptWithAnnotationDescriptions } from '@/components/image-editor/utils/image-edit-prompt-tokens';

function ann(partial: Partial<ImageEditorAnnotation>): ImageEditorAnnotation {
  return {
    id: partial.id || 'a1',
    label: partial.label || '标注01',
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

  it('builds final prompt without region instructions', () => {
    const result = buildImageEditPrompt('保留主体并优化背景，将标注01人物皮肤更自然，增强质感，标注02将天空改成黄昏，增加层次', [
      ann({ id: 'a2', label: '标注02', description: '将天空改成黄昏，增加层次' }),
      ann({ id: 'a1', label: '标注01', description: '人物皮肤更自然，增强质感' }),
    ]);

    expect(result.regionInstructions).toBe('');
    expect(result.finalPrompt).toBe(
      '保留主体并优化背景，将标注01人物皮肤更自然，增强质感，标注02将天空改成黄昏，增加层次\n\n最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。'
    );
  });

  it('throws when there is annotation without description', () => {
    expect(() => {
      buildImageEditPrompt('测试', [
        ann({ id: 'a1', label: '标注01', description: ' ' }),
      ]);
    }).toThrow('存在未补充说明的标注区域，请在 prompt 中补全后再确认。');
  });

  it('normalizes label order and numbering', () => {
    const result = buildImageEditPrompt('test，标注01two，标注02one，标注03ten', [
      ann({ id: 'a10', label: '标注10', description: 'ten' }),
      ann({ id: 'a2', label: '标注2', description: 'two' }),
      ann({ id: 'a1', label: 'foo', description: 'one' }),
    ]);

    expect(result.orderedAnnotations.map((item) => item.label)).toEqual(['标注01', '标注02', '标注03']);
    expect(result.regionInstructions).toBe('');
    expect(result.finalPrompt).toContain('最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。');
  });

  it('falls back to legacy annotation descriptions when prompt has no inline token', () => {
    const prompt = mergePromptWithAnnotationDescriptions('保留主体构图', [
      ann({ id: 'a1', label: '标注01', description: '增强人物光影' }),
      ann({ id: 'a2', label: '标注02', description: '替换局部背景为海边' }),
    ]);

    expect(prompt).toBe('保留主体构图\n标注01增强人物光影\n标注02替换局部背景为海边');

    const result = buildImageEditPrompt('保留主体构图', [
      ann({ id: 'a1', label: '标注01', description: '增强人物光影' }),
      ann({ id: 'a2', label: '标注02', description: '替换局部背景为海边' }),
    ]);

    expect(result.regionInstructions).toBe('');
  });

  it('supports legacy 标注X区域 tokens while emitting new prompt format', () => {
    const result = buildImageEditPrompt('保留主体构图，标注1区域增强人物光影，标注2区域替换局部背景为海边', [
      ann({ id: 'a1', label: '标注01', description: '' }),
      ann({ id: 'a2', label: '标注02', description: '' }),
    ]);

    expect(result.orderedAnnotations.map((item) => item.description)).toEqual([
      '增强人物光影',
      '替换局部背景为海边',
    ]);
    expect(result.finalPrompt).toBe(
      '保留主体构图，标注1区域增强人物光影，标注2区域替换局部背景为海边\n\n最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。'
    );
  });
});
