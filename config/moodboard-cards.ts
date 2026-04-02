import type { AspectRatio, ImageSize, StyleStack } from "@/types/database";

export type BuiltinShortcutId = "lemo" | "us-kv" | "sea-kv" | "jp-kv";
export type MoodboardCardId = string;
export type ShortcutFieldType = "text" | "textarea" | "select" | "number" | "color";

export interface ShortcutPromptFieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  type?: ShortcutFieldType;
  defaultValue?: string | number;
  required?: boolean;
  options?: string[];
  order?: number;
}

export interface ShortcutPromptField {
  id: string;
  label: string;
  placeholder: string;
  type?: ShortcutFieldType;
  defaultValue?: string;
  required?: boolean;
  widthClassName?: string;
  options?: string[];
}

export type ShortcutPromptPart =
  | { type: "text"; value: string }
  | { type: "field"; fieldId: string };

export interface MoodboardCard {
  id: MoodboardCardId;
  persistedId?: string;
  sortOrder?: number;
  createdAt?: string;
  name: string;
  description: string;
  detailDescription: string;
  model: string;
  modelLabel: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imagePaths: string[];
  promptComposerLayout?: "inline" | "grid";
  promptTemplate: string;
  promptFields: ShortcutPromptFieldDefinition[];
  fields: ShortcutPromptField[];
  promptParts: ShortcutPromptPart[];
}

export interface PersistedMoodboardCardRecord {
  id: string;
  code: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  name?: string;
  cover_title?: string;
  cover_subtitle?: string;
  cover_url?: string;
  coverUrlResolved?: string;
  model_id?: string;
  default_aspect_ratio?: string;
  default_width?: number;
  default_height?: number;
  prompt_template?: string;
  prompt_fields?: ShortcutPromptFieldDefinition[];
  moodboard_description?: string;
  gallery_order?: string[];
  galleryUrls?: string[];
  is_enabled?: boolean;
  publish_status?: "draft" | "published" | "archived";
}

export type ShortcutPromptValues = Record<string, string>;
export const SHORTCUT_MOODBOARD_PREFIX = "shortcut-";
const SHORTCUT_DEFAULT_MODEL = "coze_seedream4_5";
const SHORTCUT_DEFAULT_MODEL_LABEL = "Seedream 4.5";

export interface ShortcutPromptBuildOptions {
  usePlaceholder?: boolean;
  removedFieldIds?: string[];
}

export interface ShortcutRenderableFieldSegment {
  field: ShortcutPromptField;
  prefixText: string;
  value: string;
  fieldOrder: number;
}

export interface MoodboardCardEntry {
  shortcut: MoodboardCard;
  moodboard: StyleStack;
}

interface ShortcutFieldEntry {
  field: ShortcutPromptField;
  prefixText: string;
  suffixText: string;
  value: string;
  fieldOrder: number;
}

type StaticShortcutSeed = Omit<MoodboardCard, "persistedId" | "promptTemplate" | "promptFields">;

const LEADING_CLOSERS_PATTERN = /^[\s"'`’”)\]\}）】]+/;
const LEADING_SEPARATORS_PATTERN = /^[\s,;:，、]+/;
const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;
const TEMPLATE_TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;
const SHORTCUT_ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];
const SHORTCUT_ASPECT_RATIO_VALUES = new Map<AspectRatio, number>([
  ["1:1", 1],
  ["2:3", 2 / 3],
  ["3:2", 3 / 2],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["21:9", 21 / 9],
]);

const buildFields = (...fields: ShortcutPromptField[]) => fields;

const buildKvFields = () => buildFields(
  {
    id: "mainTitle",
    label: "活动主标题",
    placeholder: "主标题文案",
    required: true,
    widthClassName: "min-w-[10rem]",
  },
  {
    id: "subTitle",
    label: "活动副标题",
    placeholder: "副标题或卖点",
    required: true,
    widthClassName: "min-w-[10rem]",
  },
  {
    id: "eventTime",
    label: "活动时间",
    placeholder: "如 03.01 - 03.15",
    required: true,
    widthClassName: "min-w-[9rem]",
  },
  {
    id: "heroSubject",
    label: "主体物",
    placeholder: "主体物或主视觉隐喻",
    required: true,
    widthClassName: "min-w-[11rem]",
  },
  {
    id: "style",
    label: "想要的风格",
    placeholder: "商业摄影 / 插画 / 海报等",
    required: true,
    widthClassName: "min-w-[11rem]",
  },
  {
    id: "primaryColor",
    label: "主色调",
    placeholder: "#F2FF00",
    type: "color",
    required: true,
    widthClassName: "min-w-[9rem]",
  },
);

function normalizeShortcutFieldType(value?: string | null): ShortcutFieldType {
  switch (value) {
    case "textarea":
    case "select":
    case "number":
    case "color":
      return value;
    default:
      return "text";
  }
}

function buildPromptFieldDefinition(field: ShortcutPromptField, order: number): ShortcutPromptFieldDefinition {
  return {
    key: field.id,
    label: field.label,
    placeholder: field.placeholder,
    type: normalizeShortcutFieldType(field.type),
    defaultValue: field.defaultValue,
    required: field.required,
    options: field.options,
    order,
  };
}

function buildRuntimeField(
  definition: ShortcutPromptFieldDefinition,
  fallbackField?: ShortcutPromptField,
): ShortcutPromptField {
  const normalizedType = normalizeShortcutFieldType(definition.type);

  return {
    id: definition.key,
    label: definition.label || fallbackField?.label || definition.key,
    placeholder: definition.placeholder || fallbackField?.placeholder || definition.key,
    type: normalizedType,
    defaultValue: definition.defaultValue === undefined || definition.defaultValue === null
      ? (fallbackField?.defaultValue || "")
      : String(definition.defaultValue),
    required: definition.required ?? fallbackField?.required ?? false,
    widthClassName: fallbackField?.widthClassName,
    options: definition.options || fallbackField?.options,
  };
}

export function serializeShortcutPromptTemplate(parts: ShortcutPromptPart[]): string {
  return parts.map((part) => (
    part.type === "text" ? part.value : `{{${part.fieldId}}}`
  )).join("");
}

function parseShortcutPromptTemplate(
  template: string,
  fields: ShortcutPromptField[],
): ShortcutPromptPart[] {
  const parts: ShortcutPromptPart[] = [];
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  let lastIndex = 0;

  for (const match of template.matchAll(TEMPLATE_TOKEN_PATTERN)) {
    const token = match[1]?.trim();
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        type: "text",
        value: template.slice(lastIndex, index),
      });
    }

    if (token) {
      if (!fieldById.has(token)) {
        fieldById.set(token, {
          id: token,
          label: token,
          placeholder: token,
          type: "text",
          defaultValue: "",
          required: false,
        });
      }
      parts.push({ type: "field", fieldId: token });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < template.length) {
    parts.push({
      type: "text",
      value: template.slice(lastIndex),
    });
  }

  if (parts.length === 0) {
    return [{ type: "text", value: template }];
  }

  return parts;
}

export function extractShortcutTemplateTokens(template: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const match of template.matchAll(TEMPLATE_TOKEN_PATTERN)) {
    const token = match[1]?.trim();
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

function normalizePromptFieldDefinitions(
  input: ShortcutPromptFieldDefinition[] | undefined | null,
  fallbackFields: ShortcutPromptField[],
): ShortcutPromptFieldDefinition[] {
  const fallbackByKey = new Map(fallbackFields.map((field, index) => [
    field.id,
    buildPromptFieldDefinition(field, index),
  ]));

  if (input === undefined || input === null) {
    return fallbackFields.map((field, index) => buildPromptFieldDefinition(field, index));
  }

  if (input.length === 0) {
    return [];
  }

  const normalized: ShortcutPromptFieldDefinition[] = [];
  const seen = new Set<string>();

  input.forEach((rawField, index) => {
    const key = typeof rawField?.key === "string" ? rawField.key.trim() : "";
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);

    const fallback = fallbackByKey.get(key);
    normalized.push({
      key,
      label: typeof rawField.label === "string" && rawField.label.trim()
        ? rawField.label.trim()
        : (fallback?.label || key),
      placeholder: typeof rawField.placeholder === "string" && rawField.placeholder.trim()
        ? rawField.placeholder.trim()
        : (fallback?.placeholder || key),
      type: normalizeShortcutFieldType(rawField.type || fallback?.type),
      defaultValue: rawField.defaultValue ?? fallback?.defaultValue,
      required: rawField.required ?? fallback?.required ?? false,
      options: Array.isArray(rawField.options)
        ? rawField.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0)
        : (fallback?.options || []),
      order: typeof rawField.order === "number" ? rawField.order : (fallback?.order ?? index),
    });
  });

  if (normalized.length === 0) {
    return fallbackFields.map((field, index) => buildPromptFieldDefinition(field, index));
  }

  return normalized.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

function inferAspectRatioFromDimensions(width?: number, height?: number): AspectRatio {
  if (!width || !height || width <= 0 || height <= 0) {
    return "1:1";
  }

  const targetRatio = width / height;
  let bestMatch: AspectRatio = "1:1";
  let bestDiff = Number.POSITIVE_INFINITY;

  SHORTCUT_ASPECT_RATIOS.forEach((aspectRatio) => {
    const ratio = SHORTCUT_ASPECT_RATIO_VALUES.get(aspectRatio);
    if (!ratio) {
      return;
    }

    const diff = Math.abs(ratio - targetRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = aspectRatio;
    }
  });

  return bestMatch;
}

function resolveShortcutAspectRatio(
  record?: Pick<PersistedMoodboardCardRecord, "default_aspect_ratio" | "default_width" | "default_height">,
  fallback?: AspectRatio,
): AspectRatio {
  const aspectRatio = record?.default_aspect_ratio?.trim() as AspectRatio | undefined;
  if (aspectRatio && SHORTCUT_ASPECT_RATIOS.includes(aspectRatio)) {
    return aspectRatio;
  }

  const inferred = inferAspectRatioFromDimensions(record?.default_width, record?.default_height);
  if (inferred !== "1:1") {
    return inferred;
  }

  return fallback || "1:1";
}

function resolveShortcutImageSize(
  record?: Pick<PersistedMoodboardCardRecord, "default_width" | "default_height">,
  fallback?: ImageSize,
): ImageSize {
  const longestSide = Math.max(record?.default_width || 0, record?.default_height || 0);

  if (longestSide >= 4096) {
    return "4K";
  }
  if (longestSide >= 1536) {
    return "2K";
  }
  if (longestSide > 0) {
    return "1K";
  }

  return fallback || "2K";
}

function resolveShortcutImagePaths(
  record?: Pick<PersistedMoodboardCardRecord, "galleryUrls" | "coverUrlResolved" | "cover_url">,
  fallbackImagePaths: string[] = [],
) {
  if (Array.isArray(record?.galleryUrls) && record.galleryUrls.length > 0) {
    return record.galleryUrls;
  }

  if (record?.coverUrlResolved?.trim()) {
    return [record.coverUrlResolved.trim()];
  }

  if (record?.cover_url?.trim()) {
    return [record.cover_url.trim()];
  }

  return fallbackImagePaths;
}

function finalizeShortcut(seed: StaticShortcutSeed, index: number): MoodboardCard {
  const promptTemplate = serializeShortcutPromptTemplate(seed.promptParts);
  const promptFields = seed.fields.map((field, index) => buildPromptFieldDefinition(field, index));

  return {
    ...seed,
    sortOrder: index,
    promptTemplate,
    promptFields,
  };
}

const PLAYGROUND_SHORTCUT_SEEDS: StaticShortcutSeed[] = [
  {
    id: "lemo",
    name: "Lemo",
    description: "Lemo 角色生成",
    detailDescription:
      "Lemo 角色生成。快速应用会锁定到 Seedream 4.5，并给出适合角色场景图的模板化 prompt。",
    model: SHORTCUT_DEFAULT_MODEL,
    modelLabel: SHORTCUT_DEFAULT_MODEL_LABEL,
    aspectRatio: "1:1",
    imageSize: "2K",
    imagePaths: [
      "/loras/lemo_flux_v1.webp",
      "/loras/2dlemoV3.webp",
      "/loras/lemopin1_v1.webp",
    ],
    fields: buildFields(
      { id: "action", label: "动作", placeholder: "在做什么", required: true, widthClassName: "min-w-[5rem]" },
      { id: "outfit", label: "穿搭", placeholder: "服装或配饰", required: true, widthClassName: "min-w-[5rem]" },
      { id: "scene", label: "场景", placeholder: "具体场景", required: true, widthClassName: "min-w-[5rem]" },
      { id: "mood", label: "氛围", placeholder: "情绪和画面感", required: true, widthClassName: "min-w-[5rem]" },
      { id: "background", label: "背景", placeholder: "背景颜色或元素", defaultValue: "soft pastel backdrop", required: true, widthClassName: "min-w-[5rem]" },
      { id: "extra", label: "补充要求", placeholder: "额外细节", defaultValue: "brand-ready illustration finish", required: true, widthClassName: "min-w-[5rem]" },
    ),
    promptParts: [
      { type: "text", value: "A polished Lemo campaign visual, Lemo is " },
      { type: "field", fieldId: "action" },
      { type: "text", value: ", wearing " },
      { type: "field", fieldId: "outfit" },
      { type: "text", value: ", set in " },
      { type: "field", fieldId: "scene" },
      { type: "text", value: ", with " },
      { type: "field", fieldId: "mood" },
      { type: "text", value: ", background " },
      { type: "field", fieldId: "background" },
      { type: "text", value: ", premium composition, clean lighting, character-forward framing, " },
      { type: "field", fieldId: "extra" },
    ],
  },
  {
    id: "us-kv",
    name: "USkv",
    description: "Seedream 4.5 美区 KV 模板",
    detailDescription:
      "偏向美区海报和 campaign KV。默认使用 Seedream 4.5，适合广告级版式、标题和商业陈列感。",
    model: SHORTCUT_DEFAULT_MODEL,
    modelLabel: SHORTCUT_DEFAULT_MODEL_LABEL,
    aspectRatio: "4:5",
    imageSize: "2K",
    promptComposerLayout: "grid",
    imagePaths: [
      "/loras/USKV_V1.webp",
      "/loras/lemopin1_v1.webp",
      "/loras/美式喜剧风格插画_GPT4o(同款)_1.0.webp",
    ],
    fields: buildKvFields(),
    promptParts: [
      { type: "text", value: "Create a US-EVENT KV with main title \"" },
      { type: "field", fieldId: "mainTitle" },
      { type: "text", value: "\"，supporting title \"" },
      { type: "field", fieldId: "subTitle" },
      { type: "text", value: "\", event timing \"" },
      { type: "field", fieldId: "eventTime" },
      { type: "text", value: "\", featuring hero subject \"" },
      { type: "field", fieldId: "heroSubject" },
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
    ],
  },
  {
    id: "sea-kv",
    name: "SEA KV",
    description: "Seedream 4.5 东南亚 KV 模板",
    detailDescription:
      "偏向明快、强信息层级和生活方式感。默认使用 Seedream 4.5，适合活动页首图和 regional campaign KV。",
    model: SHORTCUT_DEFAULT_MODEL,
    modelLabel: SHORTCUT_DEFAULT_MODEL_LABEL,
    aspectRatio: "4:5",
    imageSize: "2K",
    promptComposerLayout: "grid",
    imagePaths: [
      "/loras/citypop.webp",
      "/loras/Scandinavian_graphic_illustration-000001.webp",
      "/loras/J_flat_illustration.webp",
    ],
    fields: buildKvFields(),
    promptParts: [
      { type: "text", value: "Create a SEA-EVENT KV with main title \"" },
      { type: "field", fieldId: "mainTitle" },
      { type: "text", value: "\", supporting title \"" },
      { type: "field", fieldId: "subTitle" },
      { type: "text", value: "\", event timing \"" },
      { type: "field", fieldId: "eventTime" },
      { type: "text", value: "\", featuring hero subject \"" },
      { type: "field", fieldId: "heroSubject" },
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
    ],
  },
  {
    id: "jp-kv",
    name: "JP KV",
    description: "Seedream 4.5 日区 KV 模板",
    detailDescription:
      "偏向日区海报、插画式广告和更细致的版面秩序。默认使用 Seedream 4.5，适合 title-heavy 的 KV 方向。",
    model: SHORTCUT_DEFAULT_MODEL,
    modelLabel: SHORTCUT_DEFAULT_MODEL_LABEL,
    aspectRatio: "3:2",
    imageSize: "2K",
    promptComposerLayout: "grid",
    imagePaths: [
      "/loras/JPbannerV1.webp",
      "/loras/JPv3.webp",
      "/loras/jpcha.webp",
    ],
    fields: buildKvFields(),
    promptParts: [
      { type: "text", value: "Create a JP-EVENT KV with main title \"" },
      { type: "field", fieldId: "mainTitle" },
      { type: "text", value: "\", supporting title \"" },
      { type: "field", fieldId: "subTitle" },
      { type: "text", value: "\", event timing \"" },
      { type: "field", fieldId: "eventTime" },
      { type: "text", value: "\", featuring hero subject \"" },
      { type: "field", fieldId: "heroSubject" },
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
    ],
  },
];

export const PLAYGROUND_SHORTCUTS: MoodboardCard[] = PLAYGROUND_SHORTCUT_SEEDS.map((shortcut, index) => finalizeShortcut(shortcut, index));

export function getShortcutById(
  shortcutId: MoodboardCard["id"],
  shortcuts: readonly MoodboardCard[] = PLAYGROUND_SHORTCUTS,
) {
  return shortcuts.find((shortcut) => shortcut.id === shortcutId);
}

export function createShortcutPromptValues(shortcut: MoodboardCard): ShortcutPromptValues {
  return shortcut.fields.reduce<ShortcutPromptValues>((acc, field) => {
    acc[field.id] = field.defaultValue || "";
    return acc;
  }, {});
}

export function sanitizeShortcutColorDraft(value: string): string {
  const cleaned = value.replace(/[^0-9a-fA-F#]/g, "").replace(/^#+/, "").slice(0, 6).toUpperCase();
  return cleaned ? `#${cleaned}` : "";
}

export function normalizeShortcutColorValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const draft = sanitizeShortcutColorDraft(value);
  if (!HEX_COLOR_PATTERN.test(draft)) {
    return "";
  }

  if (draft.length === 4) {
    return `#${draft[1]}${draft[1]}${draft[2]}${draft[2]}${draft[3]}${draft[3]}`;
  }

  return draft;
}

function resolveShortcutFieldPromptValue(field: ShortcutPromptField, value: string): string {
  if (field.type === "color") {
    return normalizeShortcutColorValue(value);
  }

  return value.trim();
}

function sanitizeSegmentPrefix(
  value: string,
  segmentIndex: number,
  previousFieldOrder: number | null,
  currentFieldOrder: number
) {
  if (segmentIndex === 0) {
    return value
      .replace(LEADING_CLOSERS_PATTERN, "")
      .replace(LEADING_SEPARATORS_PATTERN, "");
  }

  if (previousFieldOrder !== null && currentFieldOrder - previousFieldOrder > 1) {
    return value.trimStart();
  }

  return value;
}

function extractLeadingClosers(value: string) {
  const match = value.match(LEADING_CLOSERS_PATTERN);
  return match ? match[0].trimStart() : "";
}

function getShortcutFieldEntries(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues
): ShortcutFieldEntry[] {
  const segments: ShortcutFieldEntry[] = [];
  let fieldOrder = 0;

  shortcut.promptParts.forEach((part, index) => {
    if (part.type !== "field") {
      return;
    }

    const field = shortcut.fields.find((item) => item.id === part.fieldId);
    const prefixCandidate = index > 0 ? shortcut.promptParts[index - 1] : null;
    const suffixCandidate = index + 1 < shortcut.promptParts.length ? shortcut.promptParts[index + 1] : null;

    if (field) {
      segments.push({
        field,
        prefixText: prefixCandidate?.type === "text" ? prefixCandidate.value : "",
        suffixText: suffixCandidate?.type === "text" ? suffixCandidate.value : "",
        value: values[field.id] || "",
        fieldOrder,
      });
    }

    fieldOrder += 1;
  });

  return segments;
}

function resolveShortcutPromptSuffix(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues,
  lastRenderedFieldOrder: number | null
) {
  if (lastRenderedFieldOrder === null) {
    return "";
  }

  const fieldEntries = getShortcutFieldEntries(shortcut, values);
  const lastRenderedFieldIndex = fieldEntries.findIndex((entry) => entry.fieldOrder === lastRenderedFieldOrder);

  if (lastRenderedFieldIndex === -1) {
    return "";
  }

  const lastRenderedField = fieldEntries[lastRenderedFieldIndex];

  if (lastRenderedFieldIndex === fieldEntries.length - 1) {
    return lastRenderedField.suffixText;
  }

  return extractLeadingClosers(fieldEntries[lastRenderedFieldIndex + 1]?.prefixText || "");
}

export function getShortcutRenderableFieldSegments(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues,
  options?: Pick<ShortcutPromptBuildOptions, "removedFieldIds">
): ShortcutRenderableFieldSegment[] {
  const removedFieldIds = new Set(options?.removedFieldIds || []);
  const segments = getShortcutFieldEntries(shortcut, values).filter((entry) => !removedFieldIds.has(entry.field.id));

  return segments.map((segment, index) => ({
    ...segment,
    prefixText: sanitizeSegmentPrefix(
      segment.prefixText,
      index,
      index > 0 ? segments[index - 1]?.fieldOrder ?? null : null,
      segment.fieldOrder
    ),
  }));
}

export function getShortcutRenderablePromptSuffix(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues,
  options?: Pick<ShortcutPromptBuildOptions, "removedFieldIds">
) {
  const segments = getShortcutRenderableFieldSegments(shortcut, values, options);
  return resolveShortcutPromptSuffix(shortcut, values, segments[segments.length - 1]?.fieldOrder ?? null);
}

export function buildShortcutPrompt(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues,
  options?: ShortcutPromptBuildOptions
) {
  const hasFieldParts = shortcut.promptParts.some((part) => part.type === "field");
  if (!hasFieldParts) {
    return shortcut.promptParts
      .map((part) => (part.type === "text" ? part.value : ""))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }

  const usePlaceholder = options?.usePlaceholder ?? true;
  const segments = getShortcutRenderableFieldSegments(shortcut, values, {
    removedFieldIds: options?.removedFieldIds,
  });
  let lastRenderedFieldOrder: number | null = null;

  const promptBody = segments
    .map((segment) => {
      const value = resolveShortcutFieldPromptValue(segment.field, segment.value);
      const renderedValue = value || (usePlaceholder ? `【${segment.field.placeholder || segment.field.id}】` : "");
      if (!renderedValue) {
        return "";
      }
      lastRenderedFieldOrder = segment.fieldOrder;
      return `${segment.prefixText}${renderedValue}`;
    })
    .join("");

  const promptSuffix = resolveShortcutPromptSuffix(shortcut, values, lastRenderedFieldOrder);

  return `${promptBody}${promptSuffix}`
    .replace(/\s+/g, " ")
    .trim();
}

export function getShortcutMissingFields(
  shortcut: MoodboardCard,
  values: ShortcutPromptValues,
  options?: Pick<ShortcutPromptBuildOptions, "removedFieldIds">
) {
  const removedFieldIds = new Set(options?.removedFieldIds || []);
  return shortcut.fields.filter((field) => {
    if (!field.required || removedFieldIds.has(field.id)) {
      return false;
    }

    return !resolveShortcutFieldPromptValue(field, values[field.id] || "");
  });
}

export function getShortcutMoodboardId(shortcutId: MoodboardCard["id"]) {
  return `${SHORTCUT_MOODBOARD_PREFIX}${shortcutId}`;
}

export function getShortcutByMoodboardId(
  moodboardId: string,
  shortcuts: readonly MoodboardCard[] = PLAYGROUND_SHORTCUTS,
) {
  if (!moodboardId.startsWith(SHORTCUT_MOODBOARD_PREFIX)) {
    return null;
  }
  const shortcutId = moodboardId.slice(SHORTCUT_MOODBOARD_PREFIX.length) as MoodboardCard["id"];
  return getShortcutById(shortcutId, shortcuts) || null;
}

function buildShortcutFromRecord(options: {
  fallbackShortcut: MoodboardCard;
  record?: PersistedMoodboardCardRecord;
  modelLabels?: Map<string, string>;
}): MoodboardCard {
  const { fallbackShortcut, record, modelLabels } = options;
  const promptFields = normalizePromptFieldDefinitions(record?.prompt_fields, fallbackShortcut.fields);
  const runtimeFields = promptFields.map((fieldDefinition) => (
    buildRuntimeField(
      fieldDefinition,
      fallbackShortcut.fields.find((field) => field.id === fieldDefinition.key),
    )
  ));

  const promptTemplate = typeof record?.prompt_template === "string" && record.prompt_template.trim()
    ? record.prompt_template.trim()
    : fallbackShortcut.promptTemplate;

  const runtimeFieldsById = new Map(runtimeFields.map((field) => [field.id, field]));
  extractShortcutTemplateTokens(promptTemplate).forEach((token) => {
    if (runtimeFieldsById.has(token)) {
      return;
    }
    const fallbackField = fallbackShortcut.fields.find((field) => field.id === token);
    const definition = fallbackField
      ? buildPromptFieldDefinition(fallbackField, promptFields.length)
      : {
        key: token,
        label: token,
        placeholder: token,
        type: "text" as const,
        defaultValue: "",
        required: false,
        order: promptFields.length,
      };
    promptFields.push(definition);
    runtimeFields.push(buildRuntimeField(definition, fallbackField));
    runtimeFieldsById.set(token, runtimeFields[runtimeFields.length - 1]);
  });

  const model = record?.model_id?.trim() || fallbackShortcut.model;

  return {
    ...fallbackShortcut,
    persistedId: record?.id,
    sortOrder: record?.sort_order ?? fallbackShortcut.sortOrder,
    createdAt: record?.created_at || fallbackShortcut.createdAt,
    name: record?.name?.trim() || fallbackShortcut.name,
    description: record?.cover_subtitle?.trim() || fallbackShortcut.description,
    detailDescription: record?.moodboard_description?.trim() || fallbackShortcut.detailDescription,
    model,
    modelLabel: modelLabels?.get(model) || fallbackShortcut.modelLabel || model,
    aspectRatio: resolveShortcutAspectRatio(record, fallbackShortcut.aspectRatio),
    imageSize: resolveShortcutImageSize(record, fallbackShortcut.imageSize),
    imagePaths: resolveShortcutImagePaths(record, fallbackShortcut.imagePaths),
    promptTemplate,
    promptFields,
    fields: runtimeFields,
    promptParts: parseShortcutPromptTemplate(promptTemplate, runtimeFields),
  };
}

function buildCustomShortcutFromRecord(options: {
  record: PersistedMoodboardCardRecord;
  modelLabels?: Map<string, string>;
}): MoodboardCard | null {
  const { record, modelLabels } = options;
  const shortcutCode = record.code?.trim();

  if (!shortcutCode) {
    return null;
  }

  const promptFields = normalizePromptFieldDefinitions(record.prompt_fields, []);
  const runtimeFields = promptFields.map((fieldDefinition) => buildRuntimeField(fieldDefinition));
  const promptTemplate = typeof record.prompt_template === "string" && record.prompt_template.trim()
    ? record.prompt_template.trim()
    : "";
  const runtimeFieldsById = new Map(runtimeFields.map((field) => [field.id, field]));

  extractShortcutTemplateTokens(promptTemplate).forEach((token) => {
    if (runtimeFieldsById.has(token)) {
      return;
    }

    const definition: ShortcutPromptFieldDefinition = {
      key: token,
      label: token,
      placeholder: token,
      type: "text",
      defaultValue: "",
      required: false,
      order: promptFields.length,
    };

    promptFields.push(definition);
    runtimeFields.push(buildRuntimeField(definition));
    runtimeFieldsById.set(token, runtimeFields[runtimeFields.length - 1]);
  });

  const model = record.model_id?.trim() || SHORTCUT_DEFAULT_MODEL;
  const name = record.name?.trim() || record.cover_title?.trim() || shortcutCode;
  const description = record.cover_subtitle?.trim() || record.moodboard_description?.trim() || "自定义快捷入口";
  const detailDescription = record.moodboard_description?.trim() || description;

  return {
    id: shortcutCode,
    persistedId: record.id,
    sortOrder: record.sort_order,
    createdAt: record.created_at,
    name,
    description,
    detailDescription,
    model,
    modelLabel: modelLabels?.get(model) || model,
    aspectRatio: resolveShortcutAspectRatio(record),
    imageSize: resolveShortcutImageSize(record),
    imagePaths: resolveShortcutImagePaths(record),
    promptTemplate,
    promptFields,
    fields: runtimeFields,
    promptParts: parseShortcutPromptTemplate(promptTemplate, runtimeFields),
  };
}

export function buildShortcutFromDraft(options: {
  baseShortcut: MoodboardCard;
  name?: string;
  detailDescription?: string;
  model?: string;
  modelLabel?: string;
  promptTemplate?: string;
  promptFields?: ShortcutPromptFieldDefinition[];
}): MoodboardCard {
  const { baseShortcut } = options;
  const promptFields = normalizePromptFieldDefinitions(options.promptFields, baseShortcut.fields);
  const runtimeFields = promptFields.map((fieldDefinition) => (
    buildRuntimeField(
      fieldDefinition,
      baseShortcut.fields.find((field) => field.id === fieldDefinition.key),
    )
  ));
  const promptTemplate = options.promptTemplate === undefined
    ? baseShortcut.promptTemplate
    : options.promptTemplate.trim();
  const runtimeFieldsById = new Map(runtimeFields.map((field) => [field.id, field]));

  extractShortcutTemplateTokens(promptTemplate).forEach((token) => {
    if (runtimeFieldsById.has(token)) {
      return;
    }
    const fallbackField = baseShortcut.fields.find((field) => field.id === token);
    const definition = fallbackField
      ? buildPromptFieldDefinition(fallbackField, promptFields.length)
      : {
        key: token,
        label: token,
        placeholder: token,
        type: "text" as const,
        defaultValue: "",
        required: false,
        order: promptFields.length,
      };
    promptFields.push(definition);
    runtimeFields.push(buildRuntimeField(definition, fallbackField));
    runtimeFieldsById.set(token, runtimeFields[runtimeFields.length - 1]);
  });

  const promptParts = parseShortcutPromptTemplate(promptTemplate, runtimeFields);

  return {
    ...baseShortcut,
    name: options.name?.trim() || baseShortcut.name,
    detailDescription: options.detailDescription?.trim() || baseShortcut.detailDescription,
    model: options.model?.trim() || baseShortcut.model,
    modelLabel: options.modelLabel?.trim() || baseShortcut.modelLabel,
    promptTemplate,
    promptFields,
    fields: runtimeFields,
    promptParts,
  };
}

export function buildRuntimeMoodboardCards(options?: {
  persistedShortcuts?: PersistedMoodboardCardRecord[];
  modelLabelById?: Map<string, string>;
}): MoodboardCard[] {
  const persistedShortcuts = options?.persistedShortcuts || [];

  if (persistedShortcuts.length === 0) {
    return [...PLAYGROUND_SHORTCUTS];
  }

  const compareMoodboardCards = (left: MoodboardCard, right: MoodboardCard) => {
    const leftHasOrder = typeof left.sortOrder === "number";
    const rightHasOrder = typeof right.sortOrder === "number";

    if (leftHasOrder && rightHasOrder && left.sortOrder !== right.sortOrder) {
      return (left.sortOrder as number) - (right.sortOrder as number);
    }

    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1;
    }

    const leftCreatedAt = Date.parse(left.createdAt || "");
    const rightCreatedAt = Date.parse(right.createdAt || "");
    const leftHasCreatedAt = Number.isFinite(leftCreatedAt);
    const rightHasCreatedAt = Number.isFinite(rightCreatedAt);

    if (leftHasCreatedAt && rightHasCreatedAt && leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    if (leftHasCreatedAt !== rightHasCreatedAt) {
      return leftHasCreatedAt ? -1 : 1;
    }

    const nameCompare = left.name.localeCompare(right.name, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    });

    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.id.localeCompare(right.id);
  };

  const persistedByCode = new Map<string, PersistedMoodboardCardRecord>();
  persistedShortcuts.forEach((record) => {
    const shortcutCode = record.code?.trim();
    if (!shortcutCode || persistedByCode.has(shortcutCode)) {
      return;
    }
    persistedByCode.set(shortcutCode, record);
  });

  const builtinShortcutsById = new Map(
    PLAYGROUND_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]),
  );

  const builtinRuntimeShortcuts = PLAYGROUND_SHORTCUTS.map((fallbackShortcut) => {
    const persistedRecord = persistedByCode.get(fallbackShortcut.id);
    if (!persistedRecord) {
      return fallbackShortcut;
    }

    const runtimeShortcut = buildShortcutFromRecord({
      fallbackShortcut,
      record: persistedRecord,
      modelLabels: options?.modelLabelById,
    });

    // System presets should always keep stable order in UI.
    return {
      ...runtimeShortcut,
      sortOrder: fallbackShortcut.sortOrder,
    };
  });

  const customRuntimeShortcuts = persistedShortcuts
    .map((record) => {
      const shortcutCode = record.code?.trim();
      if (!shortcutCode || builtinShortcutsById.has(shortcutCode)) {
        return null;
      }

      return buildCustomShortcutFromRecord({
        record,
        modelLabels: options?.modelLabelById,
      });
    })
    .filter((shortcut): shortcut is MoodboardCard => shortcut !== null)
    .sort(compareMoodboardCards);

  return [...builtinRuntimeShortcuts, ...customRuntimeShortcuts];
}

export function extractShortcutMoodboardEntries(
  moodboards: StyleStack[],
  shortcuts: readonly MoodboardCard[],
): MoodboardCardEntry[] {
  return moodboards
    .map((moodboard) => {
      const shortcut = getShortcutByMoodboardId(moodboard.id, shortcuts);

      if (!shortcut) {
        return null;
      }

      return {
        shortcut,
        moodboard,
      };
    })
    .filter((entry): entry is MoodboardCardEntry => Boolean(entry))
    .sort((left, right) => {
      const leftHasOrder = typeof left.shortcut.sortOrder === "number";
      const rightHasOrder = typeof right.shortcut.sortOrder === "number";

      if (leftHasOrder && rightHasOrder && left.shortcut.sortOrder !== right.shortcut.sortOrder) {
        return (left.shortcut.sortOrder as number) - (right.shortcut.sortOrder as number);
      }

      if (leftHasOrder !== rightHasOrder) {
        return leftHasOrder ? -1 : 1;
      }

      const leftCreatedAt = Date.parse(left.shortcut.createdAt || "");
      const rightCreatedAt = Date.parse(right.shortcut.createdAt || "");
      const leftHasCreatedAt = Number.isFinite(leftCreatedAt);
      const rightHasCreatedAt = Number.isFinite(rightCreatedAt);

      if (leftHasCreatedAt && rightHasCreatedAt && leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt;
      }

      if (leftHasCreatedAt !== rightHasCreatedAt) {
        return leftHasCreatedAt ? -1 : 1;
      }

      return left.moodboard.name.localeCompare(right.moodboard.name, "zh-Hans-CN", {
        numeric: true,
        sensitivity: "base",
      });
    });
}

export function buildShortcutMoodboard(shortcut: MoodboardCard): StyleStack {
  const values = createShortcutPromptValues(shortcut);
  const promptTemplate = buildShortcutPrompt(shortcut, values);

  return {
    id: getShortcutMoodboardId(shortcut.id),
    name: shortcut.name,
    prompt: promptTemplate,
    imagePaths: shortcut.imagePaths,
    updatedAt: shortcut.createdAt || new Date(0).toISOString(),
  };
}

export function mergeShortcutMoodboards(
  _styles: StyleStack[],
  shortcuts: readonly MoodboardCard[] = PLAYGROUND_SHORTCUTS,
): StyleStack[] {
  return shortcuts.map((shortcut) => buildShortcutMoodboard(shortcut));
}

export type PlaygroundShortcutId = MoodboardCardId;
export type PlaygroundShortcut = MoodboardCard;
export type PersistedPlaygroundShortcutRecord = PersistedMoodboardCardRecord;
export type ShortcutMoodboardEntry = MoodboardCardEntry;
export const buildRuntimePlaygroundShortcuts = buildRuntimeMoodboardCards;
export const MOODBOARD_CARDS = PLAYGROUND_SHORTCUTS;
export const getMoodboardCardById = getShortcutById;
export const getMoodboardCardId = getShortcutMoodboardId;
export const getMoodboardCardByMoodboardId = getShortcutByMoodboardId;
export const extractMoodboardCardEntries = extractShortcutMoodboardEntries;
export const buildMoodboardFromCard = buildShortcutMoodboard;
export const mergeMoodboardCards = mergeShortcutMoodboards;
