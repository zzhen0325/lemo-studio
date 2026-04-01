import type { ImageEditorAnnotation } from '../types';
import { orderImageEditorAnnotations } from './image-edit-prompt-tokens';

export interface BuildImageEditPromptResult {
  plainPrompt: string;
  regionInstructions: string;
  finalPrompt: string;
  orderedAnnotations: ImageEditorAnnotation[];
}

const REMOVE_ANNOTATION_BOXES_INSTRUCTION = '最终输出时请移除所有标注框和标签，不要保留任何编辑辅助标记。';
const IMAGE_EDIT_PROMPT_TOKEN_PATTERN = /标注0*(\d+)(?:区域)?/g;

function cleanupInstructionSegment(value: string): string {
  return value
    .replace(/^[\s:：,，;；、]+/u, '')
    .replace(/[\s:：,，;；、]+$/u, '')
    .trim();
}

function resolveAnnotationDescriptions(
  plainPrompt: string,
  annotations: ReturnType<typeof orderImageEditorAnnotations>,
) {
  const descriptionBuckets = new Map<number, string[]>();
  const tokenOrdersInPrompt = new Set<number>();
  const tokenMatches = Array.from(plainPrompt.matchAll(IMAGE_EDIT_PROMPT_TOKEN_PATTERN));

  tokenMatches.forEach((match, index) => {
    if (match.index === undefined) {
      return;
    }

    const tokenOrder = Number(match[1]);
    if (!Number.isFinite(tokenOrder) || tokenOrder < 1 || tokenOrder > annotations.length) {
      return;
    }

    tokenOrdersInPrompt.add(tokenOrder);

    const segmentStart = match.index + match[0].length;
    const segmentEnd = index < tokenMatches.length - 1
      ? tokenMatches[index + 1].index ?? plainPrompt.length
      : plainPrompt.length;
    const cleanedSegment = cleanupInstructionSegment(plainPrompt.slice(segmentStart, segmentEnd));
    if (!cleanedSegment) {
      return;
    }

    const current = descriptionBuckets.get(tokenOrder) || [];
    descriptionBuckets.set(tokenOrder, [...current, cleanedSegment]);
  });

  return annotations.map((annotation, index) => {
    const promptOrder = index + 1;
    const promptDescriptions = descriptionBuckets.get(promptOrder) || [];
    const descriptionFromPrompt = promptDescriptions.join('\n').trim();
    const fallbackDescription = tokenOrdersInPrompt.has(promptOrder) ? '' : annotation.description;

    return {
      ...annotation,
      description: descriptionFromPrompt || fallbackDescription,
    };
  });
}

export function buildImageEditPrompt(
  plainPromptInput: string | undefined,
  annotationsInput: ImageEditorAnnotation[] | undefined,
): BuildImageEditPromptResult {
  const plainPrompt = (plainPromptInput || '').trim();
  const orderedAnnotations = resolveAnnotationDescriptions(
    plainPrompt,
    orderImageEditorAnnotations(annotationsInput),
  );

  if (orderedAnnotations.length > 0) {
    const invalid = orderedAnnotations.find((annotation) => !annotation.description);
    if (invalid) {
      throw new Error('存在未补充说明的标注区域，请在 prompt 中补全后再确认。');
    }
  }

  const regionInstructions = '';

  const cleanupInstructions = orderedAnnotations.length > 0 ? REMOVE_ANNOTATION_BOXES_INSTRUCTION : '';

  const finalPrompt = [plainPrompt, cleanupInstructions]
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
