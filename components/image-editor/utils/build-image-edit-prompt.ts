import { compareAnnotationLabels, formatAnnotationLabel, parseAnnotationLabelIndex } from '@/lib/utils/annotation-label';
import type { ImageEditorAnnotation } from '../types';
import { IMAGE_EDITOR_ANNOTATION_LABEL } from '../theme';

export interface BuildImageEditPromptResult {
  plainPrompt: string;
  regionInstructions: string;
  finalPrompt: string;
  orderedAnnotations: ImageEditorAnnotation[];
}

const REMOVE_ANNOTATION_BOXES_INSTRUCTION = '最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。';

function normalizeRegionLabel(label: string, fallbackIndex: number): string {
  const parsed = parseAnnotationLabelIndex(label || '', IMAGE_EDITOR_ANNOTATION_LABEL);
  if (parsed !== null) {
    return formatAnnotationLabel(parsed, IMAGE_EDITOR_ANNOTATION_LABEL);
  }
  return formatAnnotationLabel(fallbackIndex, IMAGE_EDITOR_ANNOTATION_LABEL);
}

export function buildImageEditPrompt(
  plainPromptInput: string | undefined,
  annotationsInput: ImageEditorAnnotation[] | undefined,
): BuildImageEditPromptResult {
  const plainPrompt = (plainPromptInput || '').trim();
  const annotations = (annotationsInput || []).map((annotation, index) => ({
    ...annotation,
    label: normalizeRegionLabel(annotation.label, index + 1),
    description: (annotation.description || '').trim(),
  }));

  const orderedAnnotations = [...annotations]
    .sort((a, b) => compareAnnotationLabels(a.label, b.label, IMAGE_EDITOR_ANNOTATION_LABEL))
    .map((annotation, index) => ({
      ...annotation,
      label: formatAnnotationLabel(index + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
    }));

  if (orderedAnnotations.length > 0) {
    const invalid = orderedAnnotations.find((annotation) => !annotation.description);
    if (invalid) {
      throw new Error('存在未填写说明的标注区域，请补充后再确认。');
    }
  }

  const regionInstructions = orderedAnnotations.length > 0
    ? `Region Instructions:\n${orderedAnnotations.map((annotation) => `[${annotation.label}]: ${annotation.description}`).join('\n')}`
    : '';

  const cleanupInstructions = orderedAnnotations.length > 0 ? REMOVE_ANNOTATION_BOXES_INSTRUCTION : '';

  const finalPrompt = [plainPrompt, regionInstructions, cleanupInstructions]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    plainPrompt,
    regionInstructions,
    finalPrompt,
    orderedAnnotations,
  };
}
