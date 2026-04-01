import { compareAnnotationLabels, formatAnnotationLabel, parseAnnotationLabelIndex } from '@/lib/utils/annotation-label';
import type { ImageEditorAnnotation } from '../types';
import { IMAGE_EDITOR_ANNOTATION_LABEL } from '../theme';

export interface OrderedImageEditorAnnotation extends ImageEditorAnnotation {
  promptTokenLabel: string;
}

export type ImageEditPromptPart =
  | { type: 'text'; text: string }
  | { type: 'annotation-token'; annotationId: string };

const IMAGE_EDIT_PROMPT_TOKEN_PATTERN = /标注0*(\d+)(?:区域)?/g;

export function formatImageEditPromptTokenLabel(index: number): string {
  return formatAnnotationLabel(index, IMAGE_EDITOR_ANNOTATION_LABEL);
}

function normalizeRegionLabel(label: string, fallbackIndex: number): string {
  const parsed = parseAnnotationLabelIndex(label || '', IMAGE_EDITOR_ANNOTATION_LABEL);
  if (parsed !== null) {
    return formatAnnotationLabel(parsed, IMAGE_EDITOR_ANNOTATION_LABEL);
  }
  return formatAnnotationLabel(fallbackIndex, IMAGE_EDITOR_ANNOTATION_LABEL);
}

export function orderImageEditorAnnotations(
  annotationsInput: ImageEditorAnnotation[] | undefined,
): OrderedImageEditorAnnotation[] {
  const annotations = (annotationsInput || []).map((annotation, index) => ({
    ...annotation,
    label: normalizeRegionLabel(annotation.label, index + 1),
    description: (annotation.description || '').trim(),
  }));

  return [...annotations]
    .sort((a, b) => compareAnnotationLabels(a.label, b.label, IMAGE_EDITOR_ANNOTATION_LABEL))
    .map((annotation, index) => ({
      ...annotation,
      label: formatAnnotationLabel(index + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
      promptTokenLabel: formatImageEditPromptTokenLabel(index + 1),
    }));
}

export function buildPromptTokenLabelByAnnotationId(
  annotationsInput: ImageEditorAnnotation[] | undefined,
): Map<string, string> {
  return new Map(
    orderImageEditorAnnotations(annotationsInput).map((annotation) => [annotation.id, annotation.promptTokenLabel]),
  );
}

export function parseImageEditPromptParts(
  promptInput: string | undefined,
  annotationsInput: ImageEditorAnnotation[] | undefined,
): ImageEditPromptPart[][] {
  const prompt = promptInput || '';
  const orderedAnnotations = orderImageEditorAnnotations(annotationsInput);
  const paragraphs = prompt.split('\n');

  return paragraphs.map((paragraph) => {
    const parts: ImageEditPromptPart[] = [];
    let lastIndex = 0;

    for (const match of paragraph.matchAll(IMAGE_EDIT_PROMPT_TOKEN_PATTERN)) {
      const tokenOrder = Number(match[1]);
      const annotation = orderedAnnotations[tokenOrder - 1];
      if (!annotation || match.index === undefined) {
        continue;
      }

      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          text: paragraph.slice(lastIndex, match.index),
        });
      }

      parts.push({
        type: 'annotation-token',
        annotationId: annotation.id,
      });
      lastIndex = match.index + match[0].length;
    }

    const trailingText = paragraph.slice(lastIndex);
    if (trailingText || parts.length === 0) {
      parts.push({
        type: 'text',
        text: trailingText,
      });
    }

    return parts;
  });
}

export function serializeImageEditPromptParts(
  paragraphs: ImageEditPromptPart[][],
  annotationsInput: ImageEditorAnnotation[] | undefined,
): string {
  const tokenLabelByAnnotationId = buildPromptTokenLabelByAnnotationId(annotationsInput);

  return paragraphs.map((paragraph) => (
    paragraph.map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      return tokenLabelByAnnotationId.get(part.annotationId) || '';
    }).join('')
  )).join('\n');
}

export function mergePromptWithAnnotationDescriptions(
  promptInput: string | undefined,
  annotationsInput: ImageEditorAnnotation[] | undefined,
): string {
  const prompt = (promptInput || '').trim();
  const orderedAnnotations = orderImageEditorAnnotations(annotationsInput);

  if (orderedAnnotations.length === 0) {
    return prompt;
  }

  const hasPromptToken = Array.from(prompt.matchAll(IMAGE_EDIT_PROMPT_TOKEN_PATTERN)).some((match) => {
    const tokenOrder = Number(match[1]);
    return Number.isFinite(tokenOrder) && tokenOrder >= 1 && tokenOrder <= orderedAnnotations.length;
  });
  if (hasPromptToken) {
    return prompt;
  }

  const legacyLines = orderedAnnotations
    .filter((annotation) => annotation.description)
    .map((annotation) => `${annotation.promptTokenLabel}${annotation.description}`);

  return [prompt, ...legacyLines].filter(Boolean).join('\n').trim();
}
