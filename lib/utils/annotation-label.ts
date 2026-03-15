export interface AnnotationLabelConfig {
  prefix: string;
  zeroPad: number;
}

export const DEFAULT_ANNOTATION_LABEL_CONFIG: AnnotationLabelConfig = {
  prefix: '标注',
  zeroPad: 0,
};

let globalAnnotationLabelConfig: AnnotationLabelConfig = DEFAULT_ANNOTATION_LABEL_CONFIG;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function setAnnotationLabelConfig(config?: Partial<AnnotationLabelConfig>): AnnotationLabelConfig {
  globalAnnotationLabelConfig = {
    ...DEFAULT_ANNOTATION_LABEL_CONFIG,
    ...(config || {}),
  };
  return globalAnnotationLabelConfig;
}

export function getAnnotationLabelConfig(): AnnotationLabelConfig {
  return globalAnnotationLabelConfig;
}

export function formatAnnotationLabel(index: number, config?: AnnotationLabelConfig): string {
  const labelConfig = config || globalAnnotationLabelConfig;
  const normalizedIndex = Math.max(1, Math.floor(Number(index) || 1));
  const suffix = labelConfig.zeroPad > 0
    ? String(normalizedIndex).padStart(labelConfig.zeroPad, '0')
    : String(normalizedIndex);
  return `${labelConfig.prefix}${suffix}`;
}

export function parseAnnotationLabelIndex(label: string, config?: AnnotationLabelConfig): number | null {
  if (!label || typeof label !== 'string') return null;

  const labelConfig = config || globalAnnotationLabelConfig;
  const withPrefix = new RegExp(`^${escapeRegExp(labelConfig.prefix)}(\\d+)$`);
  const prefixMatch = label.trim().match(withPrefix);
  if (prefixMatch?.[1]) {
    return Number.parseInt(prefixMatch[1], 10);
  }

  const fallbackMatch = label.trim().match(/(\d+)$/);
  if (fallbackMatch?.[1]) {
    return Number.parseInt(fallbackMatch[1], 10);
  }

  return null;
}

export function compareAnnotationLabels(a: string, b: string, config?: AnnotationLabelConfig): number {
  const indexA = parseAnnotationLabelIndex(a, config);
  const indexB = parseAnnotationLabelIndex(b, config);

  if (indexA === null && indexB === null) return a.localeCompare(b);
  if (indexA === null) return 1;
  if (indexB === null) return -1;
  return indexA - indexB;
}
