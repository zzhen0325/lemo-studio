import { compareAnnotationLabels, formatAnnotationLabel, parseAnnotationLabelIndex } from '@/lib/utils/annotation-label';
import type { ImageEditorAnnotation, ImageEditorSessionSnapshot } from '../types';
import { IMAGE_EDITOR_ANNOTATION_LABEL } from '../theme';

interface MigrateLegacySnapshotOptions {
  imageWidth?: number;
  imageHeight?: number;
  plainPrompt?: string;
}

interface LegacyShapeRecord {
  id?: unknown;
  typeName?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  props?: Record<string, unknown>;
}

const DEFAULT_IMAGE_SIZE = 1024;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveLegacyStore(snapshot: Record<string, unknown>): Record<string, unknown> {
  const store = snapshot.store;
  if (store && typeof store === 'object' && !Array.isArray(store)) {
    return store as Record<string, unknown>;
  }
  return snapshot;
}

function normalizeLabel(rawLabel: string, fallbackIndex: number): string {
  const parsed = parseAnnotationLabelIndex(rawLabel, IMAGE_EDITOR_ANNOTATION_LABEL);
  if (parsed !== null) {
    return formatAnnotationLabel(parsed, IMAGE_EDITOR_ANNOTATION_LABEL);
  }
  return formatAnnotationLabel(fallbackIndex, IMAGE_EDITOR_ANNOTATION_LABEL);
}

export function migrateTldrawSnapshot(
  snapshotInput: unknown,
  options: MigrateLegacySnapshotOptions = {},
): ImageEditorSessionSnapshot | undefined {
  if (!snapshotInput || typeof snapshotInput !== 'object') {
    return undefined;
  }

  const imageWidth = Number.isFinite(options.imageWidth) && (options.imageWidth as number) > 0
    ? Math.floor(options.imageWidth as number)
    : DEFAULT_IMAGE_SIZE;
  const imageHeight = Number.isFinite(options.imageHeight) && (options.imageHeight as number) > 0
    ? Math.floor(options.imageHeight as number)
    : DEFAULT_IMAGE_SIZE;

  const snapshot = snapshotInput as Record<string, unknown>;
  const store = resolveLegacyStore(snapshot);
  const annotations: ImageEditorAnnotation[] = [];

  Object.values(store).forEach((value, index) => {
    if (!value || typeof value !== 'object') return;

    const record = value as LegacyShapeRecord;
    const props = record.props || {};

    if (record.typeName !== 'shape' || record.type !== 'annotation') {
      return;
    }

    const x = toNumber(record.x);
    const y = toNumber(record.y);
    const width = toNumber(props.w);
    const height = toNumber(props.h);

    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
      return;
    }

    const normalizedWidth = clamp(width, 1, imageWidth);
    const normalizedHeight = clamp(height, 1, imageHeight);
    const maxX = Math.max(0, imageWidth - normalizedWidth);
    const maxY = Math.max(0, imageHeight - normalizedHeight);

    const labelRaw = typeof props.name === 'string' ? props.name : '';
    const label = normalizeLabel(labelRaw, index + 1);
    const description = typeof props.content === 'string'
      ? props.content.trim()
      : typeof props.description === 'string'
        ? props.description.trim()
        : '';

    annotations.push({
      id: String(record.id || `legacy-annotation-${index + 1}`),
      label,
      description,
      x: clamp(x, 0, maxX),
      y: clamp(y, 0, maxY),
      width: normalizedWidth,
      height: normalizedHeight,
      referenceImageUrl: typeof props.referenceImageUrl === 'string' ? props.referenceImageUrl : undefined,
      color: typeof props.color === 'string' ? props.color : undefined,
    });
  });

  if (annotations.length === 0) {
    return undefined;
  }

  const orderedAnnotations = [...annotations]
    .sort((a, b) => compareAnnotationLabels(a.label, b.label, IMAGE_EDITOR_ANNOTATION_LABEL))
    .map((annotation, index) => ({
      ...annotation,
      label: formatAnnotationLabel(index + 1, IMAGE_EDITOR_ANNOTATION_LABEL),
    }));

  return {
    version: 1,
    imageWidth,
    imageHeight,
    plainPrompt: (options.plainPrompt || '').trim(),
    annotations: orderedAnnotations,
    strokes: [],
  };
}
