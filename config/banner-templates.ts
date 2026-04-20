import type { BannerFields, BannerModelId, BannerTemplateConfig } from '@/lib/playground/types';

export const DEFAULT_BANNER_ALLOWED_MODELS: BannerModelId[] = [
  'flux_klein',
  'coze_seedream4_5',
  'seed4_0407_lemo',
];
// Backward compatibility alias
export const BANNER_ALLOWED_MODELS = DEFAULT_BANNER_ALLOWED_MODELS;
const DISABLED_BANNER_MODELS = new Set<BannerModelId>([
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
]);

export const DEFAULT_BANNER_TEMPLATE_ID = 'banner-ramadhan-v1';
const CUSTOM_BANNER_TEMPLATE_STORAGE_KEY = 'banner-custom-templates-v1';

const DEFAULT_PROMPT_TEMPLATE = [
  '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
  '补充描述：{{extraDesc}}',
  '要求：',
  '1. 输出中不要保留任何标注框、标注编号或辅助线。',
  '2. 文字排版具有设计感，主标题更醒目，Subheadline作为辅助信息。',
  '3. 视觉风格统一，具备商业 Banner 质感。',
].join('\n');

const BUILTIN_BANNER_TEMPLATES: BannerTemplateConfig[] = [
  {
    id: 'banner-ramadhan-v1',
    name: 'Ramadhan 海报',
    tags: ['节日', '营销', '海报'],
    thumbnailUrl: '/images/1080X1440.png',
    baseImageUrl: '/images/1080X1440.png',
    width: 1080,
    height: 1440,
    defaultModel: 'flux_klein',
    allowedModels: DEFAULT_BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Berkahnya Ramadhan',
      subTitle: 'Bagikan postingan Ramadhan dan menangkan Hadiah Eksklusif senilai 4.5 juta!',
      timeText: '11 24 Mar',
      extraDesc: '保留绿色节庆海报风格，主标题高对比醒目，整体排版层次清晰。',
    },
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  },
  {
    id: 'banner-neon-v1',
    name: 'Neon 光效 Banner',
    tags: ['霓虹', '电商', '促销'],
    thumbnailUrl: '/images/3334.png',
    baseImageUrl: '/images/3334.png',
    width: 1440,
    height: 900,
    defaultModel: 'flux_klein',
    allowedModels: DEFAULT_BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Merry Christmas',
      subTitle: 'lalallalala',
      timeText: 'Dec 24 - Dec 31',
      extraDesc: '整体色调改为绿色调，主色为 #4BD460',
    },
    promptTemplate: [
      '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
      '补充描述：{{extraDesc}}',
      '要求：',
      '1. 输出中不要保留任何标注框、标注编号或辅助线。',
      '2. 文字排版自然，主标题更醒目，副标题作为辅助信息。',
      '3. 视觉风格统一，具备商业 Banner 质感。',
    ].join('\n'),
  },
  {
    id: 'banner-neon-v2',
    name: 'Neon 光效 Banner 2',
    tags: ['霓虹', '科技', '横版'],
    thumbnailUrl: '/images/3335.png',
    baseImageUrl: '/images/3335.png',
    width: 1440,
    height: 900,
    defaultModel: 'flux_klein',
    allowedModels: DEFAULT_BANNER_ALLOWED_MODELS,
    defaultFields: {
      mainTitle: '#Future Drops',
      subTitle: 'Launch your spring campaign in one click',
      timeText: 'Apr 12 - Apr 30',
      extraDesc: '氛围偏科技感，增加层次化高光与柔和阴影。',
    },
    promptTemplate: [
      '你将基于给定底图进行 Banner 局部编辑，保持画幅、透视和主体关系。',
      '补充描述：{{extraDesc}}',
      '要求：',
      '1. 输出中不要保留任何标注框、标注编号或辅助线。',
      '2. 文字排版自然，主标题更醒目，副标题作为辅助信息。',
      '3. 视觉风格统一，具备商业 Banner 质感。',
    ].join('\n'),
  },
];

// Kept for compatibility with legacy imports; this only includes builtin templates.
export const BANNER_TEMPLATES: BannerTemplateConfig[] = BUILTIN_BANNER_TEMPLATES;

const BUILTIN_TEMPLATE_IDS = new Set(BUILTIN_BANNER_TEMPLATES.map((template) => template.id));

const normalizeTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = (typeof tag === 'string' ? tag : '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized.slice(0, 10);
};

const normalizeFields = (value: unknown): BannerFields => {
  const fields = value && typeof value === 'object' ? (value as Partial<BannerFields>) : {};
  return {
    mainTitle: typeof fields.mainTitle === 'string' ? fields.mainTitle : '',
    subTitle: typeof fields.subTitle === 'string' ? fields.subTitle : '',
    timeText: typeof fields.timeText === 'string' ? fields.timeText : '',
    extraDesc: typeof fields.extraDesc === 'string' ? fields.extraDesc : '',
  };
};

const resolveAllowedModels = (value: unknown): BannerModelId[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_BANNER_ALLOWED_MODELS];
  }
  const seen = new Set<string>();
  const models = value
    .filter((item): item is BannerModelId => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim() as BannerModelId)
    .filter((item) => !DISABLED_BANNER_MODELS.has(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });

  return models.length > 0 ? models : [...DEFAULT_BANNER_ALLOWED_MODELS];
};

const resolveModel = (value: unknown, allowedModels: BannerModelId[]): BannerModelId => {
  if (typeof value === 'string' && allowedModels.includes(value as BannerModelId)) {
    return value as BannerModelId;
  }
  return allowedModels[0] || 'flux_klein';
};

function sanitizeBannerTemplate(input: unknown): BannerTemplateConfig | null {
  if (!input || typeof input !== 'object') return null;
  const source = input as Partial<BannerTemplateConfig>;
  if (typeof source.id !== 'string' || !source.id.trim()) return null;
  if (typeof source.name !== 'string' || !source.name.trim()) return null;
  if (typeof source.baseImageUrl !== 'string' || !source.baseImageUrl.trim()) return null;

  const width = Number(source.width);
  const height = Number(source.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;

  const promptTemplate = typeof source.promptTemplate === 'string' && source.promptTemplate.trim()
    ? source.promptTemplate
    : DEFAULT_PROMPT_TEMPLATE;

  const allowedModels = resolveAllowedModels(source.allowedModels);

  return {
    id: source.id.trim(),
    name: source.name.trim(),
    tags: normalizeTags(source.tags),
    thumbnailUrl: (typeof source.thumbnailUrl === 'string' && source.thumbnailUrl.trim())
      ? source.thumbnailUrl.trim()
      : source.baseImageUrl.trim(),
    baseImageUrl: source.baseImageUrl.trim(),
    width: Math.round(width),
    height: Math.round(height),
    defaultModel: resolveModel(source.defaultModel, allowedModels),
    allowedModels,
    defaultFields: normalizeFields(source.defaultFields),
    promptTemplate,
  };
}

const readCustomTemplates = (): BannerTemplateConfig[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_BANNER_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const normalized: BannerTemplateConfig[] = [];
    for (const template of parsed) {
      const sanitized = sanitizeBannerTemplate(template);
      if (!sanitized) continue;
      if (BUILTIN_TEMPLATE_IDS.has(sanitized.id)) continue;
      if (seen.has(sanitized.id)) continue;
      seen.add(sanitized.id);
      normalized.push(sanitized);
    }
    return normalized;
  } catch (error) {
    console.warn('[banner-templates] Failed to read custom templates:', error);
    return [];
  }
};

const writeCustomTemplates = (templates: BannerTemplateConfig[]): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CUSTOM_BANNER_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    return true;
  } catch (error) {
    console.warn('[banner-templates] Failed to write custom templates:', error);
    return false;
  }
};

export function isBuiltinBannerTemplate(templateId: string): boolean {
  return BUILTIN_TEMPLATE_IDS.has(templateId);
}

export function getCustomBannerTemplates(): BannerTemplateConfig[] {
  return readCustomTemplates();
}

export function getBannerTemplates(): BannerTemplateConfig[] {
  return [...BUILTIN_BANNER_TEMPLATES, ...readCustomTemplates()];
}

export function upsertCustomBannerTemplate(template: BannerTemplateConfig): { ok: boolean; error?: string; template?: BannerTemplateConfig } {
  const sanitized = sanitizeBannerTemplate(template);
  if (!sanitized) {
    return { ok: false, error: 'invalid-template' };
  }
  if (isBuiltinBannerTemplate(sanitized.id)) {
    return { ok: false, error: 'builtin-template-readonly' };
  }

  const list = readCustomTemplates();
  const index = list.findIndex((item) => item.id === sanitized.id);
  if (index >= 0) {
    list[index] = sanitized;
  } else {
    list.unshift(sanitized);
  }

  if (!writeCustomTemplates(list)) {
    return { ok: false, error: 'persist-failed' };
  }

  return { ok: true, template: sanitized };
}

export function deleteCustomBannerTemplate(templateId: string): boolean {
  if (!templateId || isBuiltinBannerTemplate(templateId)) return false;
  const list = readCustomTemplates();
  const nextList = list.filter((item) => item.id !== templateId);
  if (nextList.length === list.length) return false;
  return writeCustomTemplates(nextList);
}

export function createBannerTemplateDraft(sourceTemplate?: BannerTemplateConfig): BannerTemplateConfig {
  const source = sourceTemplate || BUILTIN_BANNER_TEMPLATES[0];
  const suffix = Date.now().toString(36);
  return {
    id: `banner-custom-${suffix}`,
    name: `${source?.name || '新模板'} 副本`,
    tags: [...(source?.tags || [])],
    thumbnailUrl: source?.thumbnailUrl || source?.baseImageUrl || '',
    baseImageUrl: source?.baseImageUrl || '',
    width: source?.width || 1080,
    height: source?.height || 1080,
    defaultModel: source?.defaultModel || 'flux_klein',
    allowedModels: [...(source?.allowedModels || DEFAULT_BANNER_ALLOWED_MODELS)],
    defaultFields: {
      mainTitle: source?.defaultFields?.mainTitle || '',
      subTitle: source?.defaultFields?.subTitle || '',
      timeText: source?.defaultFields?.timeText || '',
      extraDesc: source?.defaultFields?.extraDesc || '',
    },
    promptTemplate: source?.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
  };
}

export function getBannerTemplateById(templateId?: string): BannerTemplateConfig | undefined {
  const resolvedId = templateId || DEFAULT_BANNER_TEMPLATE_ID;
  const templates = getBannerTemplates();
  return (
    templates.find((template) => template.id === resolvedId)
    || templates.find((template) => template.id === DEFAULT_BANNER_TEMPLATE_ID)
    || templates[0]
  );
}
