import { MODEL_ID_FLUX_KLEIN } from "@/lib/constants/models";
import type { AspectRatio, ImageSize, StyleStack } from "@/types/database";

export interface ShortcutPromptField {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "color";
  defaultValue?: string;
  required?: boolean;
  widthClassName?: string;
}

export type ShortcutPromptPart =
  | { type: "text"; value: string }
  | { type: "field"; fieldId: string };

export interface PlaygroundShortcut {
  id: "lemo" | "us-kv" | "sea-kv" | "jp-kv";
  name: string;
  description: string;
  detailDescription: string;
  model: string;
  modelLabel: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  imagePaths: string[];
  fields: ShortcutPromptField[];
  promptParts: ShortcutPromptPart[];
}

export type ShortcutPromptValues = Record<string, string>;
export const SHORTCUT_MOODBOARD_PREFIX = "shortcut-";

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
    id: "style",
    label: "想要的风格",
    placeholder: "商业摄影 / 插画 / 海报等",
    required: true,
    widthClassName: "min-w-[11rem]",
  },
  {
    id: "primaryColor",
    label: "主色调",
    placeholder: "#FF6B00",
    type: "color",
    required: true,
    widthClassName: "min-w-[9rem]",
  },
);

const LEADING_CLOSERS_PATTERN = /^[\s"'`’”)\]\}）】]+/;
const LEADING_SEPARATORS_PATTERN = /^[\s,;:，、]+/;
const HEX_COLOR_PATTERN = /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i;

export const PLAYGROUND_SHORTCUTS: PlaygroundShortcut[] = [
  {
    id: "lemo",
    name: "Lemo",
    description: "Lemo 角色生成",
    detailDescription:
      "Lemo 角色生成。快速应用会锁定到 Lemo Seed模型，并给出适合角色场景图的模板化 prompt。",
    model: "seed4_v2_0226lemo",
    modelLabel: "Lemo Seed",
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
    description: "FluxKlein 美区 KV 模板",
    detailDescription:
      "偏向美区海报和 campaign KV。默认使用 FluxKlein，适合广告级版式、标题和商业陈列感。",
    model: MODEL_ID_FLUX_KLEIN,
    modelLabel: "FluxKlein",
    aspectRatio: "4:5",
    imageSize: "2K",
    imagePaths: [
      "/loras/USKV_V1.webp",
      "/loras/lemopin1_v1.webp",
      "/loras/美式喜剧风格插画_GPT4o(同款)_1.0.webp",
    ],
    fields: buildKvFields(),
    promptParts: [
      { type: "text", value: "Create a US-EVENT KV with main title \"" },
      { type: "field", fieldId: "mainTitle" },
      { type: "text", value: "\", supporting title \"" },
      { type: "field", fieldId: "subTitle" },
      { type: "text", value: "\", event timing \"" },
      { type: "field", fieldId: "eventTime" },
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
      { type: "text", value: " as the dominant palette, premium studio lighting, polished ad-poster composition, strong title hierarchy, retail-ready commercial finish" },
    ],
  },
  {
    id: "sea-kv",
    name: "SEA KV",
    description: "FluxKlein 东南亚 KV 模板",
    detailDescription:
      "偏向明快、强信息层级和生活方式感。默认使用 FluxKlein，适合活动页首图和 regional campaign KV。",
    model: MODEL_ID_FLUX_KLEIN,
    modelLabel: "FluxKlein",
    aspectRatio: "4:5",
    imageSize: "2K",
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
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
      { type: "text", value: " as the dominant palette, bright merchandising hierarchy, lifestyle energy, friendly premium finish" },
    ],
  },
  {
    id: "jp-kv",
    name: "JP KV",
    description: "FluxKlein 日区 KV 模板",
    detailDescription:
      "偏向日区海报、插画式广告和更细致的版面秩序。默认使用 FluxKlein，适合 title-heavy 的 KV 方向。",
    model: MODEL_ID_FLUX_KLEIN,
    modelLabel: "FluxKlein",
    aspectRatio: "3:2",
    imageSize: "2K",
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
      { type: "text", value: "\", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: " style, using " },
      { type: "field", fieldId: "primaryColor" },
      { type: "text", value: " as the dominant palette, clean layout rhythm, refined typography space, polished poster finish" },
    ],
  },
];

export function getShortcutById(shortcutId: PlaygroundShortcut["id"]) {
  return PLAYGROUND_SHORTCUTS.find((shortcut) => shortcut.id === shortcutId);
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
  let nextValue = value.replace(LEADING_CLOSERS_PATTERN, "");

  if (segmentIndex === 0) {
    nextValue = nextValue.replace(LEADING_SEPARATORS_PATTERN, "");
  } else if (previousFieldOrder !== null && currentFieldOrder - previousFieldOrder > 1) {
    nextValue = nextValue.trimStart();
  }

  return nextValue;
}

export function getShortcutRenderableFieldSegments(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: Pick<ShortcutPromptBuildOptions, "removedFieldIds">
): ShortcutRenderableFieldSegment[] {
  const removedFieldIds = new Set(options?.removedFieldIds || []);
  const segments: ShortcutRenderableFieldSegment[] = [];
  let fieldOrder = 0;

  shortcut.promptParts.forEach((part, index) => {
    if (part.type !== "field") {
      return;
    }

    const field = shortcut.fields.find((item) => item.id === part.fieldId);
    const prefixCandidate = index > 0 ? shortcut.promptParts[index - 1] : null;
    const prefixText = prefixCandidate?.type === "text" ? prefixCandidate.value : "";

    if (field && !removedFieldIds.has(field.id)) {
      segments.push({
        field,
        prefixText,
        value: values[field.id] || "",
        fieldOrder,
      });
    }

    fieldOrder += 1;
  });

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

export function buildShortcutPrompt(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: ShortcutPromptBuildOptions
) {
  const usePlaceholder = options?.usePlaceholder ?? true;
  const segments = getShortcutRenderableFieldSegments(shortcut, values, {
    removedFieldIds: options?.removedFieldIds,
  });

  return segments
    .map((segment) => {
      const value = resolveShortcutFieldPromptValue(segment.field, segment.value);
      const renderedValue = value || (usePlaceholder ? `【${segment.field.placeholder || segment.field.id}】` : "");
      if (!renderedValue) {
        return "";
      }
      return `${segment.prefixText}${renderedValue}`;
    })
    .join("")
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

export function getShortcutByMoodboardId(moodboardId: string) {
  if (!moodboardId.startsWith(SHORTCUT_MOODBOARD_PREFIX)) {
    return null;
  }
  const shortcutId = moodboardId.slice(SHORTCUT_MOODBOARD_PREFIX.length) as PlaygroundShortcut["id"];
  return getShortcutById(shortcutId) || null;
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

export function mergeShortcutMoodboards(styles: StyleStack[]): StyleStack[] {
  const shortcutsById = new Map(
    PLAYGROUND_SHORTCUTS.map((shortcut) => [getShortcutMoodboardId(shortcut.id), buildShortcutMoodboard(shortcut)])
  );

  const mergedShortcutMoodboards = PLAYGROUND_SHORTCUTS.map((shortcut) => {
    const shortcutMoodboardId = getShortcutMoodboardId(shortcut.id);
    const baseMoodboard = shortcutsById.get(shortcutMoodboardId)!;
    const savedMoodboard = styles.find((style) => style.id === shortcutMoodboardId);

    if (!savedMoodboard) {
      return baseMoodboard;
    }

    return {
      ...baseMoodboard,
      ...savedMoodboard,
      imagePaths:
        Array.isArray(savedMoodboard.imagePaths) && savedMoodboard.imagePaths.length > 0
          ? savedMoodboard.imagePaths
          : baseMoodboard.imagePaths,
      updatedAt: savedMoodboard.updatedAt || baseMoodboard.updatedAt,
    };
  });

  const customMoodboards = styles.filter((style) => !getShortcutByMoodboardId(style.id));
  return [...mergedShortcutMoodboards, ...customMoodboards];
}
