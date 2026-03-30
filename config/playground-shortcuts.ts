import type { AspectRatio, ImageSize, StyleStack } from "@/types/database";

export type BuiltinShortcutId = "lemo" | "us-kv" | "sea-kv" | "jp-kv";
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

export interface PlaygroundShortcut {
  id: BuiltinShortcutId;
  persistedId?: string;
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

export interface PersistedPlaygroundShortcutRecord {
  id: string;
  code: string;
  name?: string;
  model_id?: string;
  prompt_template?: string;
  prompt_fields?: ShortcutPromptFieldDefinition[];
  moodboard_description?: string;
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

interface ShortcutFieldEntry {
  field: ShortcutPromptField;
  prefixText: string;
  suffixText: string;
  value: string;
  fieldOrder: number;
}

interface StaticShortcutSeed extends Omit<PlaygroundShortcut, "persistedId" | "promptTemplate" | "promptFields"> {}

const LEADING_CLOSERS_PATTERN = /^[\s"'`’”)\]\}）】]+/;
const LEADING_SEPARATORS_PATTERN = /^[\s,;:，、]+/;
const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;
const TEMPLATE_TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;

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
  input: ShortcutPromptFieldDefinition[] | undefined,
  fallbackFields: ShortcutPromptField[],
): ShortcutPromptFieldDefinition[] {
  const fallbackByKey = new Map(fallbackFields.map((field, index) => [
    field.id,
    buildPromptFieldDefinition(field, index),
  ]));

  if (input === undefined) {
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

function finalizeShortcut(seed: StaticShortcutSeed): PlaygroundShortcut {
  const promptTemplate = serializeShortcutPromptTemplate(seed.promptParts);
  const promptFields = seed.fields.map((field, index) => buildPromptFieldDefinition(field, index));

  return {
    ...seed,
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
      { id: "action", label: "动作", placeholder: "在做什么", required: true, widthClassName: "min-w-[8rem]" },
      { id: "outfit", label: "穿搭", placeholder: "服装或配饰", required: true, widthClassName: "min-w-[8rem]" },
      { id: "scene", label: "场景", placeholder: "具体场景", required: true, widthClassName: "min-w-[8rem]" },
      { id: "mood", label: "氛围", placeholder: "情绪和画面感", required: true, widthClassName: "min-w-[9rem]" },
      { id: "background", label: "背景", placeholder: "背景颜色或元素", defaultValue: "soft pastel backdrop", required: true, widthClassName: "min-w-[9rem]" },
      { id: "extra", label: "补充要求", placeholder: "额外细节", defaultValue: "brand-ready illustration finish", required: true, widthClassName: "min-w-[9rem]" },
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

export const PLAYGROUND_SHORTCUTS: PlaygroundShortcut[] = PLAYGROUND_SHORTCUT_SEEDS.map((shortcut) => finalizeShortcut(shortcut));

export function getShortcutById(
  shortcutId: PlaygroundShortcut["id"],
  shortcuts: readonly PlaygroundShortcut[] = PLAYGROUND_SHORTCUTS,
) {
  return shortcuts.find((shortcut) => shortcut.id === shortcutId);
}

export function createShortcutPromptValues(shortcut: PlaygroundShortcut): ShortcutPromptValues {
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
  shortcut: PlaygroundShortcut,
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
  shortcut: PlaygroundShortcut,
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
  shortcut: PlaygroundShortcut,
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
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: Pick<ShortcutPromptBuildOptions, "removedFieldIds">
) {
  const segments = getShortcutRenderableFieldSegments(shortcut, values, options);
  return resolveShortcutPromptSuffix(shortcut, values, segments[segments.length - 1]?.fieldOrder ?? null);
}

export function buildShortcutPrompt(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: ShortcutPromptBuildOptions
) {
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
  shortcut: PlaygroundShortcut,
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

export function getShortcutMoodboardId(shortcutId: PlaygroundShortcut["id"]) {
  return `${SHORTCUT_MOODBOARD_PREFIX}${shortcutId}`;
}

export function getShortcutByMoodboardId(
  moodboardId: string,
  shortcuts: readonly PlaygroundShortcut[] = PLAYGROUND_SHORTCUTS,
) {
  if (!moodboardId.startsWith(SHORTCUT_MOODBOARD_PREFIX)) {
    return null;
  }
  const shortcutId = moodboardId.slice(SHORTCUT_MOODBOARD_PREFIX.length) as PlaygroundShortcut["id"];
  return getShortcutById(shortcutId, shortcuts) || null;
}

function buildShortcutFromRecord(options: {
  fallbackShortcut: PlaygroundShortcut;
  record?: PersistedPlaygroundShortcutRecord;
  legacyStyle?: StyleStack;
  modelLabels?: Map<string, string>;
}): PlaygroundShortcut {
  const { fallbackShortcut, record, legacyStyle, modelLabels } = options;
  const promptFields = normalizePromptFieldDefinitions(record?.prompt_fields, fallbackShortcut.fields);
  const runtimeFields = promptFields.map((fieldDefinition) => (
    buildRuntimeField(
      fieldDefinition,
      fallbackShortcut.fields.find((field) => field.id === fieldDefinition.key),
    )
  ));

  const promptTemplate = typeof record?.prompt_template === "string" && record.prompt_template.trim()
    ? record.prompt_template.trim()
    : (legacyStyle?.prompt?.trim() || fallbackShortcut.promptTemplate);

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
    name: record?.name?.trim() || legacyStyle?.name?.trim() || fallbackShortcut.name,
    detailDescription: record?.moodboard_description?.trim() || fallbackShortcut.detailDescription,
    model,
    modelLabel: modelLabels?.get(model) || fallbackShortcut.modelLabel || model,
    promptTemplate,
    promptFields,
    fields: runtimeFields,
    promptParts: parseShortcutPromptTemplate(promptTemplate, runtimeFields),
  };
}

export function buildShortcutFromDraft(options: {
  baseShortcut: PlaygroundShortcut;
  name?: string;
  detailDescription?: string;
  model?: string;
  modelLabel?: string;
  promptTemplate?: string;
  promptFields?: ShortcutPromptFieldDefinition[];
}): PlaygroundShortcut {
  const { baseShortcut } = options;
  const promptFields = normalizePromptFieldDefinitions(options.promptFields, baseShortcut.fields);
  const runtimeFields = promptFields.map((fieldDefinition) => (
    buildRuntimeField(
      fieldDefinition,
      baseShortcut.fields.find((field) => field.id === fieldDefinition.key),
    )
  ));
  const promptTemplate = options.promptTemplate?.trim() || baseShortcut.promptTemplate;
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

export function buildRuntimePlaygroundShortcuts(options?: {
  persistedShortcuts?: PersistedPlaygroundShortcutRecord[];
  legacyStyles?: StyleStack[];
  modelLabelById?: Map<string, string>;
}): PlaygroundShortcut[] {
  const persistedShortcutsByCode = new Map(
    (options?.persistedShortcuts || []).map((shortcut) => [shortcut.code, shortcut]),
  );
  const legacyStylesById = new Map(
    (options?.legacyStyles || []).map((style) => [style.id, style]),
  );

  return PLAYGROUND_SHORTCUTS.map((fallbackShortcut) => buildShortcutFromRecord({
    fallbackShortcut,
    record: persistedShortcutsByCode.get(fallbackShortcut.id),
    legacyStyle: legacyStylesById.get(getShortcutMoodboardId(fallbackShortcut.id)),
    modelLabels: options?.modelLabelById,
  }));
}

export function buildShortcutMoodboard(shortcut: PlaygroundShortcut): StyleStack {
  const values = createShortcutPromptValues(shortcut);
  const promptTemplate = buildShortcutPrompt(shortcut, values);

  return {
    id: getShortcutMoodboardId(shortcut.id),
    name: shortcut.name,
    prompt: promptTemplate,
    imagePaths: shortcut.imagePaths,
    updatedAt: new Date(0).toISOString(),
  };
}

export function mergeShortcutMoodboards(
  styles: StyleStack[],
  shortcuts: readonly PlaygroundShortcut[] = PLAYGROUND_SHORTCUTS,
): StyleStack[] {
  const shortcutsById = new Map(
    shortcuts.map((shortcut) => [getShortcutMoodboardId(shortcut.id), buildShortcutMoodboard(shortcut)])
  );

  const mergedShortcutMoodboards = shortcuts.map((shortcut) => {
    const shortcutMoodboardId = getShortcutMoodboardId(shortcut.id);
    const baseMoodboard = shortcutsById.get(shortcutMoodboardId)!;
    const savedMoodboard = styles.find((style) => style.id === shortcutMoodboardId);

    if (!savedMoodboard) {
      return baseMoodboard;
    }

    return {
      ...baseMoodboard,
      imagePaths: Array.isArray(savedMoodboard.imagePaths)
        ? savedMoodboard.imagePaths
        : baseMoodboard.imagePaths,
      collageImageUrl: savedMoodboard.collageImageUrl,
      collageConfig: savedMoodboard.collageConfig,
      updatedAt: savedMoodboard.updatedAt || baseMoodboard.updatedAt,
    };
  });

  const customMoodboards = styles.filter((style) => !getShortcutByMoodboardId(style.id, shortcuts));
  return [...mergedShortcutMoodboards, ...customMoodboards];
}
