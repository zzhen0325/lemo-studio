import { MODEL_ID_FLUX_KLEIN } from "@/lib/constants/models";
import type { AspectRatio, ImageSize } from "@/types/database";

export interface ShortcutPromptField {
  id: string;
  label: string;
  placeholder: string;
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

const buildFields = (...fields: ShortcutPromptField[]) => fields;

export const PLAYGROUND_SHORTCUTS: PlaygroundShortcut[] = [
  {
    id: "lemo",
    name: "lemo",
    description: "Seed4.2 专属角色入口",
    detailDescription:
      "主打 Lemo 角色 KV。这个入口会锁定到 Seed4.2 Lemo，并给出适合角色场景图的模板化 prompt。",
    model: "seed4_v2_0226lemo",
    modelLabel: "Seed4.2 Lemo",
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
    fields: buildFields(
      { id: "campaign", label: "活动主题", placeholder: "campaign 名称", required: true, widthClassName: "min-w-[9rem]" },
      { id: "subject", label: "主体", placeholder: "人物或产品", required: true, widthClassName: "min-w-[8rem]" },
      { id: "styling", label: "风格", placeholder: "视觉风格", required: true, widthClassName: "min-w-[8rem]" },
      { id: "headline", label: "标题文案", placeholder: "主标题", defaultValue: "hero campaign headline", required: true, widthClassName: "min-w-[9rem]" },
      { id: "background", label: "背景", placeholder: "背景设定", defaultValue: "clean studio backdrop", required: true, widthClassName: "min-w-[9rem]" },
      { id: "extra", label: "补充要求", placeholder: "补充视觉要求", defaultValue: "premium commercial finish", required: true, widthClassName: "min-w-[9rem]" },
    ),
    promptParts: [
      { type: "text", value: "Create a US-market campaign key visual for " },
      { type: "field", fieldId: "campaign" },
      { type: "text", value: ", featuring " },
      { type: "field", fieldId: "subject" },
      { type: "text", value: ", in " },
      { type: "field", fieldId: "styling" },
      { type: "text", value: ", headline text \"" },
      { type: "field", fieldId: "headline" },
      { type: "text", value: "\", background " },
      { type: "field", fieldId: "background" },
      { type: "text", value: ", premium studio lighting, polished ad-poster composition, " },
      { type: "field", fieldId: "extra" },
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
    fields: buildFields(
      { id: "campaign", label: "活动主题", placeholder: "campaign 名称", required: true, widthClassName: "min-w-[9rem]" },
      { id: "subject", label: "主体", placeholder: "人物或产品", required: true, widthClassName: "min-w-[8rem]" },
      { id: "palette", label: "主色调", placeholder: "色彩关键词", required: true, widthClassName: "min-w-[8rem]" },
      { id: "headline", label: "标题文案", placeholder: "主标题", defaultValue: "regional promo headline", required: true, widthClassName: "min-w-[9rem]" },
      { id: "scene", label: "场景", placeholder: "日常或节日场景", defaultValue: "lifestyle retail setting", required: true, widthClassName: "min-w-[9rem]" },
      { id: "extra", label: "补充要求", placeholder: "补充视觉要求", defaultValue: "bright merchandising hierarchy", required: true, widthClassName: "min-w-[9rem]" },
    ),
    promptParts: [
      { type: "text", value: "Create an energetic SEA key visual for " },
      { type: "field", fieldId: "campaign" },
      { type: "text", value: ", featuring " },
      { type: "field", fieldId: "subject" },
      { type: "text", value: ", with a " },
      { type: "field", fieldId: "palette" },
      { type: "text", value: " color direction, headline \"" },
      { type: "field", fieldId: "headline" },
      { type: "text", value: "\", lifestyle scene " },
      { type: "field", fieldId: "scene" },
      { type: "text", value: ", crisp merchandising layout, friendly premium finish, " },
      { type: "field", fieldId: "extra" },
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
    fields: buildFields(
      { id: "campaign", label: "活动主题", placeholder: "campaign 名称", required: true, widthClassName: "min-w-[9rem]" },
      { id: "subject", label: "主体", placeholder: "人物或产品", required: true, widthClassName: "min-w-[8rem]" },
      { id: "style", label: "风格", placeholder: "海报风格", required: true, widthClassName: "min-w-[8rem]" },
      { id: "headline", label: "标题文案", placeholder: "主标题", defaultValue: "main campaign title", required: true, widthClassName: "min-w-[9rem]" },
      { id: "supporting", label: "辅助文案", placeholder: "副标题或卖点", defaultValue: "short supporting copy", required: true, widthClassName: "min-w-[10rem]" },
      { id: "extra", label: "补充要求", placeholder: "补充视觉要求", defaultValue: "refined poster finish", required: true, widthClassName: "min-w-[9rem]" },
    ),
    promptParts: [
      { type: "text", value: "Create a JP-market poster KV for " },
      { type: "field", fieldId: "campaign" },
      { type: "text", value: ", featuring " },
      { type: "field", fieldId: "subject" },
      { type: "text", value: ", in " },
      { type: "field", fieldId: "style" },
      { type: "text", value: ", main title \"" },
      { type: "field", fieldId: "headline" },
      { type: "text", value: "\", supporting copy \"" },
      { type: "field", fieldId: "supporting" },
      { type: "text", value: "\", clean layout rhythm, refined typography space, " },
      { type: "field", fieldId: "extra" },
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

export function buildShortcutPrompt(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: { usePlaceholder?: boolean }
) {
  const usePlaceholder = options?.usePlaceholder ?? true;

  return shortcut.promptParts
    .map((part) => {
      if (part.type === "text") {
        return part.value;
      }

      const field = shortcut.fields.find((item) => item.id === part.fieldId);
      const value = values[part.fieldId]?.trim();
      if (value) {
        return value;
      }
      if (!usePlaceholder) {
        return "";
      }
      return `【${field?.placeholder || part.fieldId}】`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function getShortcutMissingFields(shortcut: PlaygroundShortcut, values: ShortcutPromptValues) {
  return shortcut.fields.filter((field) => field.required && !values[field.id]?.trim());
}
