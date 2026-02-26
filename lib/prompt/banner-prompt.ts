import type {
  BannerFields,
  BannerModeActiveData,
  BannerRegionInstruction,
  BannerTextPositionInstruction,
  BannerTextPositionType,
  BannerTemplateConfig,
} from '@/components/features/playground-v2/types';
import {
  compareAnnotationLabels,
  formatAnnotationLabel,
  parseAnnotationLabelIndex,
  type AnnotationLabelConfig,
} from '@/lib/utils/annotation-label';

export const BANNER_REGION_LABEL_CONFIG: AnnotationLabelConfig = {
  prefix: '区域',
  zeroPad: 2,
};

const FIELD_KEYS: Array<keyof BannerFields> = ['mainTitle', 'subTitle', 'timeText', 'extraDesc'];

const DEFAULT_BANNER_TEXT_POSITION_TYPES: BannerTextPositionType[] = ['mainTitle', 'subTitle', 'timeText'];

const TEXT_POSITION_TYPE_LABEL_MAP: Record<BannerTextPositionType, string> = {
  mainTitle: '主标题',
  subTitle: '副标题',
  timeText: '时间',
  custom: '自定义文字',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function formatAlphabetLabel(index: number): string {
  let value = Math.max(1, Math.floor(Number(index) || 1));
  let label = '';

  while (value > 0) {
    const offset = (value - 1) % 26;
    label = String.fromCharCode(65 + offset) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function getDefaultTextPosition(index: number, template: BannerTemplateConfig): { x: number; y: number } {
  const baseX = Math.round(template.width * 0.18);
  const baseY = Math.round(template.height * 0.2);
  const stepY = Math.round(template.height * 0.11);
  const y = baseY + (index * stepY);

  return {
    x: clamp(baseX, 0, template.width),
    y: clamp(y, 0, template.height),
  };
}

export function normalizeBannerFields(input?: Partial<BannerFields>): BannerFields {
  return {
    mainTitle: input?.mainTitle || '',
    subTitle: input?.subTitle || '',
    timeText: input?.timeText || '',
    extraDesc: input?.extraDesc || '',
  };
}

function fillTemplate(templatePrompt: string, template: BannerTemplateConfig, fields: BannerFields): string {
  const fieldValues: BannerFields & {
    originalMainTitle: string;
    originalSubTitle: string;
    originalTimeText: string;
  } = {
    ...fields,
    originalMainTitle: template.defaultFields.mainTitle || '',
    originalSubTitle: template.defaultFields.subTitle || '',
    originalTimeText: template.defaultFields.timeText || '',
  };

  return templatePrompt.replace(
    /\{\{\s*(mainTitle|subTitle|timeText|extraDesc|originalMainTitle|originalSubTitle|originalTimeText)\s*\}\}/g,
    (_, key: keyof typeof fieldValues) => fieldValues[key] || '',
  );
}

export function normalizeBannerTextPositions(
  textPositions: BannerTextPositionInstruction[],
  template?: BannerTemplateConfig,
): BannerTextPositionInstruction[] {
  return textPositions.map((item, index) => {
    const fallback = template ? getDefaultTextPosition(index, template) : { x: undefined, y: undefined };
    const sourceX = typeof item.x === 'number' ? item.x : fallback.x;
    const sourceY = typeof item.y === 'number' ? item.y : fallback.y;
    const x = typeof sourceX === 'number' && template
      ? clamp(sourceX, 0, template.width)
      : sourceX;
    const y = typeof sourceY === 'number' && template
      ? clamp(sourceY, 0, template.height)
      : sourceY;

    return {
      ...item,
      id: item.id || `banner-text-position-${index + 1}`,
      label: formatAlphabetLabel(index + 1),
      type: item.type || 'custom',
      x: typeof x === 'number' ? Math.round(x) : undefined,
      y: typeof y === 'number' ? Math.round(y) : undefined,
      note: (item.note || '').trim(),
    };
  });
}

function createDefaultBannerTextPositions(template: BannerTemplateConfig): BannerTextPositionInstruction[] {
  const initial = DEFAULT_BANNER_TEXT_POSITION_TYPES.map((type, index) => {
    const { x, y } = getDefaultTextPosition(index, template);
    return {
      id: `banner-text-position-${type}`,
      label: formatAlphabetLabel(index + 1),
      type,
      x,
      y,
      note: '',
    } satisfies BannerTextPositionInstruction;
  });

  return normalizeBannerTextPositions(initial, template);
}

export function normalizeBannerRegions(regions: BannerRegionInstruction[]): BannerRegionInstruction[] {
  const sorted = [...regions].sort((a, b) => {
    const byLabel = compareAnnotationLabels(a.label || '', b.label || '', BANNER_REGION_LABEL_CONFIG);
    if (byLabel !== 0) return byLabel;
    return (a.id || '').localeCompare(b.id || '');
  });

  return sorted.map((region, index) => ({
    ...region,
    id: region.id || `banner-region-${index + 1}`,
    label: formatAnnotationLabel(index + 1, BANNER_REGION_LABEL_CONFIG),
    description: (region.description || '').trim(),
  }));
}

export function buildBannerPrompt(
  template: BannerTemplateConfig,
  fields: BannerFields,
  regions: BannerRegionInstruction[],
  textPositions: BannerTextPositionInstruction[],
): string {
  const normalizedFields = normalizeBannerFields(fields);
  const basePrompt = fillTemplate(template.promptTemplate, template, normalizedFields).trim();
  const normalizedTextPositions = normalizeBannerTextPositions(textPositions, template)
    .filter((item) => typeof item.x === 'number' && typeof item.y === 'number');
  const normalizedRegions = normalizeBannerRegions(regions).filter((region) => Boolean(region.description));

  if (normalizedTextPositions.length === 0 && normalizedRegions.length === 0) {
    return basePrompt;
  }

  const promptSections = [basePrompt];

  if (normalizedTextPositions.length > 0) {
    const toPercent = (value: number, total: number) => ((value / Math.max(1, total)) * 100).toFixed(1);
    const textPositionLines = normalizedTextPositions.map((item) => {
      const typeLabel = TEXT_POSITION_TYPE_LABEL_MAP[item.type] || TEXT_POSITION_TYPE_LABEL_MAP.custom;
      const note = item.note ? `，说明：${item.note}` : '';
      return `[${item.label}] ${typeLabel}，位置约 (${toPercent(item.x || 0, template.width)}%, ${toPercent(item.y || 0, template.height)}%)${note}`;
    });
    promptSections.push(`Text Position Markers:\n${textPositionLines.join('\n')}`);
  }

  const regionLines = normalizedRegions.map((region) => `[${region.label}]: ${region.description}`);
  if (regionLines.length > 0) {
    promptSections.push(`Region Instructions:\n${regionLines.join('\n')}`);
  }

  return promptSections.join('\n\n').trim();
}

export function createBannerModeData(template: BannerTemplateConfig): BannerModeActiveData {
  const fields = normalizeBannerFields(template.defaultFields);
  const regions: BannerRegionInstruction[] = [];
  const textPositions = createDefaultBannerTextPositions(template);
  return {
    templateId: template.id,
    model: template.defaultModel,
    fields,
    regions,
    textPositions,
    promptFinal: buildBannerPrompt(template, fields, regions, textPositions),
    promptEdited: false,
  };
}

export function extractBannerRegionsFromSnapshot(snapshot: unknown): BannerRegionInstruction[] {
  const snapshotObj = snapshot as { store?: Record<string, Record<string, unknown>> } | null;
  const store = snapshotObj?.store && typeof snapshotObj.store === 'object'
    ? snapshotObj.store
    : (snapshot as Record<string, Record<string, unknown>> | null);

  if (!store || typeof store !== 'object') {
    return [];
  }

  const regions: BannerRegionInstruction[] = Object.values(store)
    .filter((record) => {
      return record?.typeName === 'shape' && record?.type === 'annotation';
    })
    .map((record, index) => {
      const props = (record.props || {}) as Record<string, unknown>;
      const rawLabel = typeof props.name === 'string' ? props.name : formatAnnotationLabel(index + 1, BANNER_REGION_LABEL_CONFIG);
      const parsedIndex = parseAnnotationLabelIndex(rawLabel, BANNER_REGION_LABEL_CONFIG);
      const normalizedLabel = parsedIndex
        ? formatAnnotationLabel(parsedIndex, BANNER_REGION_LABEL_CONFIG)
        : rawLabel;

      return {
        id: String(record.id || `banner-region-${index + 1}`),
        label: normalizedLabel,
        description: typeof props.content === 'string' ? props.content : '',
        referenceImageUrl: typeof props.referenceImageUrl === 'string' ? props.referenceImageUrl : undefined,
        x: typeof record.x === 'number' ? record.x : undefined,
        y: typeof record.y === 'number' ? record.y : undefined,
        width: typeof props.w === 'number' ? props.w : undefined,
        height: typeof props.h === 'number' ? props.h : undefined,
      };
    });

  return normalizeBannerRegions(regions);
}

export function isBannerPromptDirty(activeData: BannerModeActiveData, template: BannerTemplateConfig): boolean {
  const rebuilt = buildBannerPrompt(template, activeData.fields, activeData.regions, activeData.textPositions || []);
  return rebuilt.trim() !== (activeData.promptFinal || '').trim();
}

export function buildBannerPromptFromActiveData(
  activeData: BannerModeActiveData,
  template: BannerTemplateConfig,
): string {
  return buildBannerPrompt(template, activeData.fields, activeData.regions, activeData.textPositions || []);
}

export function pickBannerFieldsForHistory(fields: BannerFields): BannerFields {
  return FIELD_KEYS.reduce((acc, key) => {
    acc[key] = fields[key];
    return acc;
  }, {} as BannerFields);
}

export function pickBannerTextPositionsForHistory(
  textPositions: BannerTextPositionInstruction[],
): BannerTextPositionInstruction[] {
  return normalizeBannerTextPositions(textPositions).map((item) => ({
    id: item.id,
    label: item.label,
    type: item.type,
    x: typeof item.x === 'number' ? Math.round(item.x) : undefined,
    y: typeof item.y === 'number' ? Math.round(item.y) : undefined,
    note: item.note || '',
  }));
}
