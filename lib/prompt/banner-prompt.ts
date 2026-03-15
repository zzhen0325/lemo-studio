import type {
  BannerFields,
  BannerModeActiveData,
  BannerRegionInstruction,
  BannerTextPositionInstruction,
  BannerTemplateConfig,
} from '@/lib/playground/types';
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

function toRegionRoleLabel(role: BannerRegionInstruction['role']): string {
  if (role === 'mainTitle') return '主标题';
  if (role === 'subTitle') return '副标题';
  if (role === 'timeText') return '时间';
  return '文字';
}

function getRegionRoleFallbackText(role: BannerRegionInstruction['role']): string {
  if (role === 'mainTitle') return '请输入标题内容';
  if (role === 'subTitle') return '请输入副标题内容';
  if (role === 'timeText') return '请输入时间内容';
  return '请输入文字内容';
}

const BANNER_TEMPLATE_PRESET_STORAGE_KEY = 'banner-template-region-presets-v1';

function getFieldValueByRole(role: BannerRegionInstruction['role'], fields: BannerFields): string {
  if (role === 'mainTitle') return fields.mainTitle || '';
  if (role === 'subTitle') return fields.subTitle || '';
  if (role === 'timeText') return fields.timeText || '';
  return '';
}

export function isBannerTextRegion(region: BannerRegionInstruction): boolean {
  return region.mode === 'text'
    || region.role === 'mainTitle'
    || region.role === 'subTitle'
    || region.role === 'timeText';
}

export function extractBannerRegionTargetText(description: string): string {
  const raw = description || '';
  const byFullWidthColon = raw.split('：');
  if (byFullWidthColon.length > 1) {
    return byFullWidthColon.slice(1).join('：').trim();
  }
  const byColon = raw.split(':');
  if (byColon.length > 1) {
    return byColon.slice(1).join(':').trim();
  }
  return raw.trim();
}

function buildBannerTextRegionDescription(
  region: BannerRegionInstruction,
  regionIndex: number,
): string {
  const regionName = (region.name || toRegionRoleLabel(region.role)).trim() || `文字${regionIndex}`;
  const target = extractBannerRegionTargetText(region.description)
    || (region.sourceText || '').trim()
    || getRegionRoleFallbackText(region.role);
  return `${regionName}（区域${regionIndex}）：${target}`;
}

export function syncBannerTextRegionDescriptions(
  regions: BannerRegionInstruction[],
): BannerRegionInstruction[] {
  const normalizedRegions = normalizeBannerRegions(regions);

  return normalizedRegions.map((region, index) => {
    const regionIndex = parseAnnotationLabelIndex(region.label, BANNER_REGION_LABEL_CONFIG) || (index + 1);
    if (!isBannerTextRegion(region)) {
      return region;
    }

    const name = (region.name || toRegionRoleLabel(region.role)).trim() || `文字${regionIndex}`;
    const sourceText = (region.sourceText || '').trim();
    return {
      ...region,
      mode: 'text',
      name,
      sourceText,
      description: buildBannerTextRegionDescription({ ...region, name, sourceText }, regionIndex),
    };
  });
}

export function createPresetBannerRegions(
  template: BannerTemplateConfig,
  fields: BannerFields,
): BannerRegionInstruction[] {
  const definitions: Array<{ role: NonNullable<BannerRegionInstruction['role']>; x: number; y: number; width: number; height: number }> = [
    { role: 'mainTitle', x: 0.11, y: 0.13, width: 0.78, height: 0.14 },
    { role: 'subTitle', x: 0.11, y: 0.31, width: 0.78, height: 0.17 },
    { role: 'timeText', x: 0.11, y: 0.54, width: 0.42, height: 0.1 },
  ];

  const regions = definitions.map((definition, index) => {
    const width = Math.round(template.width * definition.width);
    const height = Math.round(template.height * definition.height);
    const maxX = Math.max(0, template.width - width);
    const maxY = Math.max(0, template.height - height);

    return {
      id: `banner-region-preset-${definition.role}-${index + 1}`,
      label: formatAnnotationLabel(index + 1, BANNER_REGION_LABEL_CONFIG),
      role: definition.role,
      mode: 'text',
      name: toRegionRoleLabel(definition.role),
      sourceText: getFieldValueByRole(definition.role, fields).trim(),
      description: '',
      x: clamp(Math.round(template.width * definition.x), 0, maxX),
      y: clamp(Math.round(template.height * definition.y), 0, maxY),
      width,
      height,
    } satisfies BannerRegionInstruction;
  });

  return syncBannerTextRegionDescriptions(regions);
}

export function buildBannerPrompt(
  template: BannerTemplateConfig,
  fields: BannerFields,
  regions: BannerRegionInstruction[],
  _textPositions: BannerTextPositionInstruction[],
): string {
  void _textPositions;
  const normalizedFields = normalizeBannerFields(fields);
  const basePrompt = fillTemplate(template.promptTemplate, template, normalizedFields).trim();
  const normalizedRegions = syncBannerTextRegionDescriptions(regions).filter((region) => Boolean(region.description));
  const textEditLines: string[] = [];
  const customRegionLines: string[] = [];

  normalizedRegions.forEach((region, index) => {
    const regionIndex = parseAnnotationLabelIndex(region.label, BANNER_REGION_LABEL_CONFIG) || (index + 1);
    if (isBannerTextRegion(region)) {
      const originalText = (region.sourceText || '').trim()
        || extractBannerRegionTargetText(region.description)
        || getRegionRoleFallbackText(region.role);
      const targetText = extractBannerRegionTargetText(region.description)
        || originalText
        || getRegionRoleFallbackText(region.role);
      textEditLines.push(`将区域${regionIndex}的文字「${originalText}」修改为「${targetText}」`);
      return;
    }

    customRegionLines.push(`[${region.label}]: ${region.description}`);
  });

  if (textEditLines.length === 0 && customRegionLines.length === 0) return basePrompt;

  const promptSections = [basePrompt];

  if (textEditLines.length > 0) {
    promptSections.push(`文字修改指令:\n${textEditLines.join('\n')}`);
  }

  if (customRegionLines.length > 0) {
    promptSections.push('标注框说明：文字位置与局部修改均以以下红框区域为准。');
    promptSections.push(`Region Instructions:\n${customRegionLines.join('\n')}`);
  }

  return promptSections.join('\n\n').trim();
}

export function createBannerModeData(template: BannerTemplateConfig): BannerModeActiveData {
  const fields = normalizeBannerFields(template.defaultFields);
  const regions: BannerRegionInstruction[] = createPresetBannerRegions(template, fields);
  const textPositions: BannerTextPositionInstruction[] = [];
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

  return syncBannerTextRegionDescriptions(normalizeBannerRegions(regions));
}

function sanitizeTemplatePresetRegion(region: BannerRegionInstruction): BannerRegionInstruction {
  return {
    id: region.id,
    label: region.label,
    description: region.description,
    role: region.role,
    mode: region.mode,
    name: region.name,
    sourceText: region.sourceText,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    referenceImageUrl: region.referenceImageUrl,
  };
}

export function loadBannerTemplatePresetRegions(templateId: string): BannerRegionInstruction[] | null {
  if (typeof window === 'undefined' || !templateId) return null;

  try {
    const raw = window.localStorage.getItem(BANNER_TEMPLATE_PRESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, BannerRegionInstruction[]>;
    const regions = parsed?.[templateId];
    if (!Array.isArray(regions)) return null;
    return syncBannerTextRegionDescriptions(regions.map(sanitizeTemplatePresetRegion));
  } catch (error) {
    console.warn('[banner-prompt] Failed to load banner template presets:', error);
    return null;
  }
}

export function saveBannerTemplatePresetRegions(templateId: string, regions: BannerRegionInstruction[]): boolean {
  if (typeof window === 'undefined' || !templateId) return false;

  try {
    const raw = window.localStorage.getItem(BANNER_TEMPLATE_PRESET_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, BannerRegionInstruction[]>) : {};
    const normalized = syncBannerTextRegionDescriptions(regions).map(sanitizeTemplatePresetRegion);
    parsed[templateId] = normalized;
    window.localStorage.setItem(BANNER_TEMPLATE_PRESET_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch (error) {
    console.warn('[banner-prompt] Failed to save banner template presets:', error);
    return false;
  }
}

export function clearBannerTemplatePresetRegions(templateId: string): boolean {
  if (typeof window === 'undefined' || !templateId) return false;

  try {
    const raw = window.localStorage.getItem(BANNER_TEMPLATE_PRESET_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, BannerRegionInstruction[]>;
    delete parsed[templateId];
    window.localStorage.setItem(BANNER_TEMPLATE_PRESET_STORAGE_KEY, JSON.stringify(parsed));
    return true;
  } catch (error) {
    console.warn('[banner-prompt] Failed to clear banner template presets:', error);
    return false;
  }
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
