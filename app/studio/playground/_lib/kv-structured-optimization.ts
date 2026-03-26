import {
  buildShortcutPrompt,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from "@/config/playground-shortcuts";

export const KV_SHORTCUT_IDS = ["us-kv", "sea-kv", "jp-kv"] as const;
export const DESIGN_STRUCTURED_SOURCE_TYPES = ["kv_shortcut", "image_reverse"] as const;
export const DESIGN_STRUCTURED_VARIANT_IDS = ["v1", "v2"] as const;
export const DESIGN_VARIANT_EDIT_SCOPES = [
  "variant",
  "canvas",
  "subject",
  "background",
  "layout",
  "typography",
] as const;
export const DESIGN_ANALYSIS_SECTION_KEYS = [
  "canvas",
  "subject",
  "background",
  "layout",
  "typography",
] as const;
export const DESIGN_STRUCTURED_MODE = "design_structured_variants_v1";
export const DESIGN_VARIANT_EDIT_MODE = "design_structured_variant_edit_v1";
export const DESIGN_CORE_FIELD_IDS = [
  "mainTitle",
  "subTitle",
  "eventTime",
  "style",
  "primaryColor",
] as const;

export const KV_STRUCTURED_VARIANT_IDS = DESIGN_STRUCTURED_VARIANT_IDS;
export const KV_STRUCTURED_ADVANCED_GROUP_KEYS = DESIGN_ANALYSIS_SECTION_KEYS;
export const KV_STRUCTURED_OPTIMIZATION_MODE = DESIGN_STRUCTURED_MODE;
export const KV_CORE_FIELD_IDS = DESIGN_CORE_FIELD_IDS;

export type KvShortcutId = (typeof KV_SHORTCUT_IDS)[number];
export type DesignStructuredSourceType = (typeof DESIGN_STRUCTURED_SOURCE_TYPES)[number];
export type DesignStructuredVariantId = (typeof DESIGN_STRUCTURED_VARIANT_IDS)[number];
export type DesignVariantEditScope = (typeof DESIGN_VARIANT_EDIT_SCOPES)[number];
export type DesignAnalysisSectionKey = (typeof DESIGN_ANALYSIS_SECTION_KEYS)[number];
export type DesignCoreFieldId = (typeof DESIGN_CORE_FIELD_IDS)[number];

export type KvStructuredVariantId = DesignStructuredVariantId;
export type KvStructuredAdvancedGroupKey = DesignAnalysisSectionKey;
export type KvCoreFieldId = DesignCoreFieldId;

export interface DesignStructuredCoreFields {
  mainTitle: string;
  subTitle: string;
  eventTime: string;
  style: string;
  primaryColor: string;
}

export interface DesignStructuredPaletteEntry {
  hex: string;
  weight: string;
}

export interface DesignStructuredAnalysisSection {
  tokens: string[];
  detailText: string;
}

export interface DesignStructuredAnalysis {
  canvas: DesignStructuredAnalysisSection;
  subject: DesignStructuredAnalysisSection;
  background: DesignStructuredAnalysisSection;
  layout: DesignStructuredAnalysisSection;
  typography: DesignStructuredAnalysisSection;
}

export interface DesignStructuredVariant {
  id: DesignStructuredVariantId;
  label: string;
  coreFields: DesignStructuredCoreFields;
  coreSuggestions: DesignStructuredCoreFields;
  palette: DesignStructuredPaletteEntry[];
  analysis: DesignStructuredAnalysis;
  promptPreview: string;
}

export interface DesignStructuredVariantsResponse {
  mode: typeof DESIGN_STRUCTURED_MODE;
  sourceType: DesignStructuredSourceType;
  variants: DesignStructuredVariant[];
}

export interface DesignStructuredVariantEditResponse {
  mode: typeof DESIGN_VARIANT_EDIT_MODE;
  variant: DesignStructuredVariant;
}

export type KvStructuredCoreFields = DesignStructuredCoreFields;
export type KvStructuredPaletteEntry = DesignStructuredPaletteEntry;
export type KvStructuredAnalysisSection = DesignStructuredAnalysisSection;
export type KvStructuredAdvanced = DesignStructuredAnalysis;
export type KvStructuredVariant = DesignStructuredVariant;
export type KvStructuredVariantsResponse = DesignStructuredVariantsResponse;
export type KvStructuredVariantEditResponse = DesignStructuredVariantEditResponse;

type LooseRecord = Record<string, unknown>;

const KV_SHORTCUT_MARKET_MAP: Record<KvShortcutId, string> = {
  "us-kv": "US",
  "sea-kv": "SEA",
  "jp-kv": "JP",
};

const SOURCE_TYPE_ALIASES: Record<string, DesignStructuredSourceType> = {
  kv: "kv_shortcut",
  kv_shortcut: "kv_shortcut",
  shortcut: "kv_shortcut",
  banner: "kv_shortcut",
  event: "kv_shortcut",
  image_reverse: "image_reverse",
  imagereverse: "image_reverse",
  reverse: "image_reverse",
  describe: "image_reverse",
  describe_json: "image_reverse",
  image: "image_reverse",
};

const EMPTY_CORE_FIELDS: DesignStructuredCoreFields = {
  mainTitle: "",
  subTitle: "",
  eventTime: "",
  style: "",
  primaryColor: "",
};

const EMPTY_ANALYSIS_SECTION: DesignStructuredAnalysisSection = {
  tokens: [],
  detailText: "",
};

export const DESIGN_STRUCTURED_OPTIMIZATION_SYSTEM_PROMPT = `你是服务于 KV / Banner / Event Poster 模板输入的结构化优化器。
输出格式已经由 json schema 提供，你只需要严格遵守 schema，不要输出解释、标题、Markdown、代码块或额外字段。

任务目标：
1. 基于用户提供的 KV 模板文本，生成 2 个不同的结构化视觉方向。
2. sourceType 固定为 "kv_shortcut"。
3. 用户明确给出的 coreFields 视为锁定值，不得改写；如有更优写法，只能写入 coreSuggestions。
4. 输出保持轻量，不需要额外生成 promptPreview，前端会基于 analysis 和必要 coreFields 本地重组最终预览。

内容要求：
1. 每个 variant 都必须有明确的 dominant hero subject，不能只是装饰元素堆砌。
2. 每个 variant 都必须形成完整场景，并体现主体、辅助元素、背景之间的关系。
3. 2 个 variants 必须从主体隐喻、场景设定、叙事方式、信息结构或版式重心上明显不同。
4. analysis 必须完整包含 canvas、subject、background、layout、typography 五组。
5. subject 必须明确谁是主角、谁是辅助。
6. layout 必须说明 mainTitle、subTitle、eventTime 与主体的关系。
7. typography 必须强调 mainTitle 是第一信息层，subTitle 和 eventTime 是次级信息层。
8. 不要输出 palette、colors、colorPalette、promptPreview 等额外结构字段。
9. 颜色信息只保留在 detailText 中，使用准确 HEX，例如 色值#A4B97E。

长度控制：
1. 每组 tokens 保持 3 到 5 个短语，不要写完整句子，不要堆砌空泛风格词。
2. 每组 detailText 保持简洁具体，优先描述主体、场景、层级和关键信息关系。

禁止事项：
1. 不要输出空洞风格词堆叠。
2. 不要输出没有主体的方案。
3. 不要输出只是若干元素散落的方案。
4. 不要输出 schema 之外的附加字段。`;

export const DESIGN_VARIANT_EDIT_SYSTEM_PROMPT = `# 角色定义
你是一个 KV 结构化 variant 微调器。
你的任务是基于“当前版本结构化结果 + 用户修改指令”，局部优化当前版本。

# 输出目标
只输出一个 JSON 对象，结构固定为：
{
  "mode": "design_structured_variant_edit_v1",
  "variant": {
    "id": "v1 或 v2",
    "label": "",
    "coreFields": {
      "mainTitle": "",
      "subTitle": "",
      "eventTime": "",
      "style": "",
      "primaryColor": ""
    },
    "coreSuggestions": {
      "mainTitle": "",
      "subTitle": "",
      "eventTime": "",
      "style": "",
      "primaryColor": ""
    },
    "analysis": {
      "canvas": { "tokens": [], "detailText": "" },
      "subject": { "tokens": [], "detailText": "" },
      "background": { "tokens": [], "detailText": "" },
      "layout": { "tokens": [], "detailText": "" },
      "typography": { "tokens": [], "detailText": "" }
    },
    "promptPreview": ""
  }
}

# 修改原则
1. 用户 instruction 是本次唯一修改目标。
2. 未被 instruction 明确涉及的部分，尽量保持稳定。
3. 不要无故重写全部内容。
4. coreFields 默认保持不变；只有用户明确要求改标题、副标题、时间、风格、主色时，才允许最小范围调整。
5. promptPreview 必须始终是一整段自然流畅、重点明确的最终 prompt，不能退化成字段拼接。

# 结构要求
1. 保留完整 variant 结构。
2. analysis 必须完整保留五段：canvas / subject / background / layout / typography。
3. tokens 必须仍然是中粒度可编辑短语。
4. detailText 保留高细节设计逻辑。

# 质量要求
1. 如果用户要求“换主体”或“更有故事”，优先改 subject，必要时最小范围联动 background、layout、typography。
2. 如果用户要求“更强标题”，优先改 layout 和 typography。
3. 如果用户要求“减少元素”，应减少 subject/background 中无效堆砌，同时保持主视觉完整。
4. 输出必须是合法 JSON。
5. 不要输出解释、Markdown、代码块或注释。`;

export const DESIGN_SECTION_EDIT_SYSTEM_PROMPT = `# 角色定义
你是一个 KV 结构化 variant 的分段微调器。
你的任务是只围绕指定 section 重写当前版本，并尽量保持其他部分稳定。

# 输出目标
只输出一个 JSON 对象，结构固定为：
{
  "mode": "design_structured_variant_edit_v1",
  "variant": {
    "id": "v1 或 v2",
    "label": "",
    "coreFields": {
      "mainTitle": "",
      "subTitle": "",
      "eventTime": "",
      "style": "",
      "primaryColor": ""
    },
    "coreSuggestions": {
      "mainTitle": "",
      "subTitle": "",
      "eventTime": "",
      "style": "",
      "primaryColor": ""
    },
    "analysis": {
      "canvas": { "tokens": [], "detailText": "" },
      "subject": { "tokens": [], "detailText": "" },
      "background": { "tokens": [], "detailText": "" },
      "layout": { "tokens": [], "detailText": "" },
      "typography": { "tokens": [], "detailText": "" }
    },
    "promptPreview": ""
  }
}

# 修改原则
1. 只重点重写用户指定的 section。
2. 其他 section 和 coreFields 尽量保持稳定。
3. 只有在必要时才做最小范围联动。
4. promptPreview 必须根据更新后的结构同步重写，并保持自然流畅的一整段。

# 结构要求
1. 返回完整 variant，不要只返回 section patch。
2. analysis 五段必须完整。
3. tokens 仍为短语，detailText 保留高细节 prose。
4. 输出必须是合法 JSON，不要附带解释。`;

export const KV_STRUCTURED_OPTIMIZATION_SYSTEM_PROMPT = DESIGN_STRUCTURED_OPTIMIZATION_SYSTEM_PROMPT;

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLooseString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function getFirstPresentValue(record: LooseRecord, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function sanitizePhraseList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniquePhraseList(values: string[]) {
  const seen = new Set<string>();

  return sanitizePhraseList(values).filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function stripBulletPrefix(value: string) {
  return value.replace(/^(?:[-*•·▪●◦]+|\d+[\.\)]\s*)/, "").trim();
}

function normalizeHex(value: string) {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9A-F]{3}$|^#[0-9A-F]{6}$/.test(withHash) ? withHash : "";
}

function extractHexMatches(text: string) {
  const matches = text.match(/#[0-9A-Fa-f]{3,6}\b/g) || [];
  return uniquePhraseList(matches.map((match) => normalizeHex(match)).filter(Boolean));
}

export const extractDesignHexMatches = extractHexMatches;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripGeneratedPaletteSummary(text: string) {
  return text
    .replace(/(?:^|,\s*)color palette:\s*[^,]+(?:;[^,]+)*/gi, " ")
    .replace(/(?:^|,\s*)palette:\s*[^,]+(?:;[^,]+)*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePaletteWeightNumber(value: string) {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return null;
  }

  const numeric = Number(matched[0]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

export function formatPaletteWeight(value: number) {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1).replace(/\.0$/, "")}%`;
}

function roundPaletteWeights(values: number[]) {
  const rounded = values.map((value) => Math.round(value * 10) / 10);
  const total = rounded.reduce((sum, value) => sum + value, 0);
  const delta = Math.round((100 - total) * 10) / 10;

  if (rounded.length > 0 && delta !== 0) {
    rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + delta) * 10) / 10;
  }

  return rounded;
}

export function normalizeDesignPalette(entries: DesignStructuredPaletteEntry[]) {
  const normalized = entries
    .map((entry) => ({
      hex: normalizeHex(entry.hex),
      weight: entry.weight.trim(),
    }))
    .filter((entry) => entry.hex);

  if (normalized.length === 0) {
    return [];
  }

  const parsedWeights: Array<number | null> = normalized.map((entry) => parsePaletteWeightNumber(entry.weight));
  const specifiedCount = parsedWeights.filter((value) => value !== null).length;

  let nextWeights: number[];

  if (specifiedCount === 0) {
    nextWeights = roundPaletteWeights(normalized.map(() => 100 / normalized.length));
  } else {
    const specifiedTotal = parsedWeights.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const unspecifiedCount = normalized.length - specifiedCount;

    if (specifiedTotal <= 0) {
      nextWeights = roundPaletteWeights(normalized.map(() => 100 / normalized.length));
    } else if (unspecifiedCount === 0) {
      nextWeights = roundPaletteWeights(parsedWeights.map((value) => ((value ?? 0) / specifiedTotal) * 100));
    } else {
      const clampedSpecifiedTotal = Math.min(specifiedTotal, 100);
      const remaining = Math.max(0, 100 - clampedSpecifiedTotal);
      const fallbackWeight = unspecifiedCount > 0 ? remaining / unspecifiedCount : 0;

      nextWeights = roundPaletteWeights(parsedWeights.map((value) => value ?? fallbackWeight));
    }
  }

  return normalized.map((entry, index) => ({
    hex: entry.hex,
    weight: formatPaletteWeight(nextWeights[index] ?? 0),
  }));
}

function inferPaletteWeightFromTexts(hex: string, texts: string[]) {
  const escapedHex = escapeRegExp(hex);

  for (const source of texts) {
    if (!source) {
      continue;
    }

    const patterns = [
      new RegExp(`占比\\s*(\\d+(?:\\.\\d+)?)%?\\s*的\\s*${escapedHex}`, "i"),
      new RegExp(`${escapedHex}[^#\\n]{0,32}?(\\d+(?:\\.\\d+)?)%`, "i"),
      new RegExp(`(\\d+(?:\\.\\d+)?)%[^#\\n]{0,32}?${escapedHex}`, "i"),
    ];

    for (const pattern of patterns) {
      const matched = source.match(pattern);
      if (matched?.[1]) {
        return formatPaletteWeight(Number(matched[1]));
      }
    }
  }

  return "";
}

export function derivePaletteFromTextSources(
  texts: string[],
  existingPalette: DesignStructuredPaletteEntry[] = [],
) {
  const strippedTexts = texts
    .map((text) => stripGeneratedPaletteSummary(text))
    .filter(Boolean);
  const extractedHexes = uniquePhraseList(strippedTexts.flatMap((text) => extractHexMatches(text)));
  const existingByHex = new Map(existingPalette.map((entry) => [normalizeHex(entry.hex), entry.weight.trim()]));
  const orderedHexes = uniquePhraseList([
    ...existingPalette.map((entry) => normalizeHex(entry.hex)).filter((hex) => extractedHexes.includes(hex)),
    ...extractedHexes,
  ]);

  return normalizeDesignPalette(orderedHexes.map((hex) => ({
    hex,
    weight: existingByHex.get(hex) || inferPaletteWeightFromTexts(hex, strippedTexts),
  })));
}

export function derivePaletteFromVariantContent(params: {
  analysis: DesignStructuredAnalysis;
  promptPreview?: string;
  basePrompt?: string;
  existingPalette?: DesignStructuredPaletteEntry[];
}) {
  return derivePaletteFromTextSources(
    [
      params.basePrompt || "",
      params.promptPreview || "",
      params.analysis.canvas.detailText,
      ...params.analysis.canvas.tokens,
      params.analysis.subject.detailText,
      ...params.analysis.subject.tokens,
      params.analysis.background.detailText,
      ...params.analysis.background.tokens,
      params.analysis.layout.detailText,
      ...params.analysis.layout.tokens,
      params.analysis.typography.detailText,
      ...params.analysis.typography.tokens,
    ],
    params.existingPalette,
  );
}

export function replaceHexColorReferences(value: string, previousHex: string, nextHex: string) {
  const normalizedPreviousHex = normalizeHex(previousHex);
  const normalizedNextHex = normalizeHex(nextHex);

  if (!value || !normalizedPreviousHex || !normalizedNextHex || normalizedPreviousHex === normalizedNextHex) {
    return value;
  }

  return value.replace(new RegExp(escapeRegExp(normalizedPreviousHex), "gi"), normalizedNextHex);
}

export function replacePaletteWeightReferences(value: string, hex: string, previousWeight: string, nextWeight: string) {
  const normalizedHex = normalizeHex(hex);
  if (!value || !normalizedHex || previousWeight.trim() === nextWeight.trim()) {
    return value;
  }

  const safePreviousWeight = previousWeight.trim();
  const safeNextWeight = nextWeight.trim();
  if (!safePreviousWeight) {
    return value;
  }

  const escapedHex = escapeRegExp(normalizedHex);
  const escapedPreviousWeight = escapeRegExp(safePreviousWeight);

  if (!safeNextWeight) {
    return value
      .replace(new RegExp(`占比\\s*${escapedPreviousWeight}\\s*的\\s*${escapedHex}`, "gi"), normalizedHex)
      .replace(new RegExp(`(${escapedHex}[^#\\n]{0,32}?)${escapedPreviousWeight}`, "gi"), "$1")
      .replace(new RegExp(`${escapedPreviousWeight}([^#\\n]{0,32}?${escapedHex})`, "gi"), "$1");
  }

  return value
    .replace(new RegExp(`(占比\\s*)${escapedPreviousWeight}(\\s*的\\s*${escapedHex})`, "gi"), `$1${safeNextWeight}$2`)
    .replace(new RegExp(`(${escapedHex}[^#\\n]{0,32}?)${escapedPreviousWeight}`, "gi"), `$1${safeNextWeight}`)
    .replace(new RegExp(`${escapedPreviousWeight}([^#\\n]{0,32}?${escapedHex})`, "gi"), `${safeNextWeight}$1`);
}

function splitPhraseString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return normalizePhraseList(JSON.parse(trimmed));
    } catch {
      // Ignore and continue with loose splitting.
    }
  }

  return uniquePhraseList(
    trimmed
      .split(/\r?\n|[，、；;]+|(?<!#),(?!\d)/)
      .map((part) => stripBulletPrefix(part))
      .filter(Boolean)
  );
}

function normalizePhraseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniquePhraseList(
      value.flatMap((item) => {
        if (typeof item === "string") {
          return splitPhraseString(item);
        }
        const scalar = toLooseString(item);
        return scalar ? [scalar] : [];
      })
    );
  }

  if (typeof value === "string") {
    return splitPhraseString(value);
  }

  if (isRecord(value)) {
    return uniquePhraseList(
      Object.values(value).flatMap((item) => normalizePhraseList(item))
    );
  }

  return [];
}

function extractJsonCandidate(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const unfenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if ((unfenced.startsWith("{") && unfenced.endsWith("}")) || (unfenced.startsWith("[") && unfenced.endsWith("]"))) {
    return unfenced;
  }

  const objectStart = unfenced.indexOf("{");
  const objectEnd = unfenced.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return unfenced.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = unfenced.indexOf("[");
  const arrayEnd = unfenced.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return unfenced.slice(arrayStart, arrayEnd + 1);
  }

  return unfenced;
}

function findBalancedJsonCandidate(raw: string) {
  const source = raw.trim();
  if (!source) {
    return "";
  }

  for (let start = 0; start < source.length; start += 1) {
    const firstChar = source[start];
    if (firstChar !== "{" && firstChar !== "[") {
      continue;
    }

    const stack = [firstChar === "{" ? "}" : "]"];
    let inString = false;
    let stringQuote = "";
    let escaped = false;

    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === stringQuote) {
          inString = false;
        }
        continue;
      }

      if (char === "\"" || char === "'") {
        inString = true;
        stringQuote = char;
        continue;
      }

      if (char === "{" || char === "[") {
        stack.push(char === "{" ? "}" : "]");
        continue;
      }

      if (char === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) {
          return source.slice(start, index + 1);
        }
      }
    }
  }

  return "";
}

type JsonQuoteKind = "double" | "single" | "curly_double" | "curly_single";

const JSON_STRUCTURAL_CHAR_MAP: Record<string, string> = {
  "：": ":",
  "，": ",",
  "｛": "{",
  "｝": "}",
  "［": "[",
  "］": "]",
};

function getJsonQuoteKind(char: string): JsonQuoteKind | null {
  if (char === "\"") {
    return "double";
  }
  if (char === "'") {
    return "single";
  }
  if (char === "“" || char === "”") {
    return "curly_double";
  }
  if (char === "‘" || char === "’") {
    return "curly_single";
  }
  return null;
}

function isMatchingJsonQuote(kind: JsonQuoteKind, char: string) {
  if (kind === "double") {
    return char === "\"";
  }
  if (kind === "single") {
    return char === "'";
  }
  if (kind === "curly_double") {
    return char === "“" || char === "”";
  }
  return char === "‘" || char === "’";
}

function isPotentialLooseStringBoundary(raw: string, index: number) {
  let lookaheadIndex = index + 1;
  while (lookaheadIndex < raw.length && /\s/.test(raw[lookaheadIndex])) {
    lookaheadIndex += 1;
  }

  const nextSignificantChar = raw[lookaheadIndex] || "";
  return (
    !nextSignificantChar
    || nextSignificantChar === ":"
    || nextSignificantChar === ","
    || nextSignificantChar === "}"
    || nextSignificantChar === "]"
    || nextSignificantChar === "："
    || nextSignificantChar === "，"
    || nextSignificantChar === "｝"
    || nextSignificantChar === "］"
  );
}

function normalizeJsonLikeSyntax(raw: string) {
  let result = "";
  let inString = false;
  let quoteKind: JsonQuoteKind | null = null;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        result += char;
        escaped = true;
        continue;
      }

      if (char === "\r") {
        if (raw[index + 1] === "\n") {
          index += 1;
        }
        result += "\\n";
        continue;
      }

      if (char === "\n") {
        result += "\\n";
        continue;
      }

      if (quoteKind && isMatchingJsonQuote(quoteKind, char) && isPotentialLooseStringBoundary(raw, index)) {
        inString = false;
        quoteKind = null;
        result += "\"";
        continue;
      }

      if (char === "\"" && quoteKind !== "double") {
        result += "\\\"";
        continue;
      }

      result += char;
      continue;
    }

    const normalizedStructuralChar = JSON_STRUCTURAL_CHAR_MAP[char];
    if (normalizedStructuralChar) {
      result += normalizedStructuralChar;
      continue;
    }

    const nextQuoteKind = getJsonQuoteKind(char);
    if (nextQuoteKind) {
      inString = true;
      quoteKind = nextQuoteKind;
      result += "\"";
      continue;
    }

    result += char;
  }

  return result;
}

function isBareJsonKeyStart(char: string) {
  return /[A-Za-z_$]/.test(char);
}

function isBareJsonKeyChar(char: string) {
  return /[A-Za-z0-9_$-]/.test(char);
}

function quoteBareJsonObjectKeys(raw: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      result += char;
      continue;
    }

    if (char !== "{" && char !== ",") {
      result += char;
      continue;
    }

    result += char;

    let lookaheadIndex = index + 1;
    while (lookaheadIndex < raw.length && /\s/.test(raw[lookaheadIndex])) {
      result += raw[lookaheadIndex];
      lookaheadIndex += 1;
    }

    const keyStart = lookaheadIndex;
    if (!isBareJsonKeyStart(raw[keyStart] || "")) {
      index = lookaheadIndex - 1;
      continue;
    }

    let keyEnd = keyStart + 1;
    while (keyEnd < raw.length && isBareJsonKeyChar(raw[keyEnd])) {
      keyEnd += 1;
    }

    let colonIndex = keyEnd;
    while (colonIndex < raw.length && /\s/.test(raw[colonIndex])) {
      colonIndex += 1;
    }

    if (raw[colonIndex] !== ":") {
      index = lookaheadIndex - 1;
      continue;
    }

    result += `"${raw.slice(keyStart, keyEnd)}"${raw.slice(keyEnd, colonIndex)}`;
    index = colonIndex - 1;
  }

  return result;
}

type JsonRepairContainerState =
  | {
    type: "object";
    state: "expectKeyOrEnd" | "expectColon" | "expectValue" | "expectCommaOrEnd";
  }
  | {
    type: "array";
    state: "expectValueOrEnd" | "expectCommaOrEnd";
  };

function findNextSignificantIndex(raw: string, startIndex: number) {
  let index = startIndex;

  while (index < raw.length && /\s/.test(raw[index])) {
    index += 1;
  }

  return index;
}

function findNextUnescapedDoubleQuote(raw: string, startIndex: number) {
  let escaped = false;

  for (let index = startIndex + 1; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      return index;
    }
  }

  return -1;
}

function markJsonRepairValueComplete(stack: JsonRepairContainerState[]) {
  const current = stack[stack.length - 1];
  if (!current) {
    return;
  }

  current.state = "expectCommaOrEnd";
}

function looksLikeObjectKeyAfterComma(raw: string, commaIndex: number) {
  const nextIndex = findNextSignificantIndex(raw, commaIndex + 1);
  const nextChar = raw[nextIndex] || "";

  if (!nextChar || nextChar === "}") {
    return true;
  }

  if (nextChar !== "\"") {
    return false;
  }

  const keyEndIndex = findNextUnescapedDoubleQuote(raw, nextIndex);
  if (keyEndIndex < 0) {
    return false;
  }

  const colonIndex = findNextSignificantIndex(raw, keyEndIndex + 1);
  return raw[colonIndex] === ":";
}

function looksLikeArrayValueAfterComma(raw: string, commaIndex: number) {
  const nextIndex = findNextSignificantIndex(raw, commaIndex + 1);
  const nextChar = raw[nextIndex] || "";

  if (!nextChar || nextChar === "]") {
    return true;
  }

  if (nextChar === "\"") {
    const valueEndIndex = findNextUnescapedDoubleQuote(raw, nextIndex);
    if (valueEndIndex < 0) {
      return false;
    }

    const afterValueIndex = findNextSignificantIndex(raw, valueEndIndex + 1);
    const afterValueChar = raw[afterValueIndex] || "";
    return !afterValueChar || afterValueChar === "," || afterValueChar === "]";
  }

  return /[\[{\-0-9tfn]/.test(nextChar);
}

function isLikelyJsonStringBoundary(
  raw: string,
  quoteIndex: number,
  stack: JsonRepairContainerState[],
  role: "key" | "value",
) {
  const nextIndex = findNextSignificantIndex(raw, quoteIndex + 1);
  const nextChar = raw[nextIndex] || "";

  if (role === "key") {
    return nextChar === ":";
  }

  if (!nextChar || nextChar === "}" || nextChar === "]") {
    return true;
  }

  if (nextChar !== ",") {
    return false;
  }

  const current = stack[stack.length - 1];
  if (!current) {
    return true;
  }

  return current.type === "object"
    ? looksLikeObjectKeyAfterComma(raw, nextIndex)
    : looksLikeArrayValueAfterComma(raw, nextIndex);
}

function escapeInnerQuotesInJsonStrings(raw: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  let stringRole: "key" | "value" = "value";
  const stack: JsonRepairContainerState[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = inString;
      continue;
    }

    if (char !== "\"") {
      if (!inString) {
        if (/\s/.test(char)) {
          result += char;
          continue;
        }

        if (char === "{") {
          result += char;
          stack.push({ type: "object", state: "expectKeyOrEnd" });
          continue;
        }

        if (char === "[") {
          result += char;
          stack.push({ type: "array", state: "expectValueOrEnd" });
          continue;
        }

        if (char === "}") {
          result += char;
          stack.pop();
          markJsonRepairValueComplete(stack);
          continue;
        }

        if (char === "]") {
          result += char;
          stack.pop();
          markJsonRepairValueComplete(stack);
          continue;
        }

        const current = stack[stack.length - 1];

        if (char === ":") {
          result += char;
          if (current?.type === "object") {
            current.state = "expectValue";
          }
          continue;
        }

        if (char === ",") {
          result += char;
          if (current?.type === "object") {
            current.state = "expectKeyOrEnd";
          } else if (current?.type === "array") {
            current.state = "expectValueOrEnd";
          }
          continue;
        }

        if (current?.type === "object" && current.state === "expectValue") {
          markJsonRepairValueComplete(stack);
        } else if (current?.type === "array" && current.state === "expectValueOrEnd") {
          markJsonRepairValueComplete(stack);
        }
      }

      result += char;
      continue;
    }

    if (!inString) {
      const current = stack[stack.length - 1];
      inString = true;
      stringRole = current?.type === "object" && current.state === "expectKeyOrEnd"
        ? "key"
        : "value";
      if (current?.type === "object" && current.state === "expectKeyOrEnd") {
        current.state = "expectColon";
      }
      result += char;
      continue;
    }

    if (isLikelyJsonStringBoundary(raw, index, stack, stringRole)) {
      inString = false;
      result += char;
      if (stringRole === "value") {
        markJsonRepairValueComplete(stack);
      }
      continue;
    }

    result += "\\\"";
  }

  return result;
}

function repairJsonCandidate(raw: string) {
  const normalized = raw
    .trim()
    .replace(/^\uFEFF/, "");

  return escapeInnerQuotesInJsonStrings(
    quoteBareJsonObjectKeys(
      normalizeJsonLikeSyntax(normalized)
        .replace(/,\s*([}\]])/g, "$1")
    )
  );
}

function parseJsonCandidate(raw: string): unknown {
  const candidates = [
    raw,
    extractJsonCandidate(raw),
    findBalancedJsonCandidate(raw),
  ]
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }

    const repaired = repairJsonCandidate(candidate);
    if (repaired === candidate) {
      continue;
    }

    try {
      return JSON.parse(repaired) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to parse structured optimization response");
}

function normalizeCoreFields(value: unknown): DesignStructuredCoreFields {
  const source = isRecord(value) ? value : {};

  return {
    mainTitle: toLooseString(getFirstPresentValue(source, ["mainTitle", "main_title", "title"])),
    subTitle: toLooseString(getFirstPresentValue(source, ["subTitle", "subtitle", "sub_title", "supportingTitle", "supporting_title"])),
    eventTime: toLooseString(getFirstPresentValue(source, ["eventTime", "event_time", "timing", "time"])),
    style: toLooseString(getFirstPresentValue(source, ["style", "visualStyle", "visual_style"])),
    primaryColor: toLooseString(getFirstPresentValue(source, ["primaryColor", "primary_color", "color", "mainColor", "main_color"])),
  };
}

function normalizeAnalysisSection(value: unknown): DesignStructuredAnalysisSection {
  if (!value) {
    return { ...EMPTY_ANALYSIS_SECTION };
  }

  if (typeof value === "string" || Array.isArray(value)) {
    return {
      tokens: normalizePhraseList(value),
      detailText: typeof value === "string" ? toLooseString(value) : "",
    };
  }

  const source = isRecord(value) ? value : {};
  const tokens = normalizePhraseList(getFirstPresentValue(source, [
    "tokens",
    "items",
    "chips",
    "phrases",
    "keywords",
  ]));
  const detailText = toLooseString(getFirstPresentValue(source, [
    "detailText",
    "detail_text",
    "description",
    "detail",
    "text",
    "prose",
  ]));

  return {
    tokens,
    detailText,
  };
}

function mergeAnalysisSection(
  base: DesignStructuredAnalysisSection,
  incoming: DesignStructuredAnalysisSection,
) {
  return {
    tokens: uniquePhraseList([...base.tokens, ...incoming.tokens]),
    detailText: incoming.detailText || base.detailText,
  };
}

function splitLegacyLayoutTypographyTokens(tokens: string[]) {
  const layoutTokens: string[] = [];
  const typographyTokens: string[] = [];
  const layoutPattern = /layout|composition|focus|balance|center|centered|top|bottom|left|right|hierarchy|sticker|tag|banner|构图|布局|焦点|层次|顶部|底部|居中|对称|标签|横幅/i;
  const typographyPattern = /font|type|text|letter|headline|title|caption|serif|sans|stroke|outline|shadow|mask|halftone|handwritten|script|字|字体|文字|描边|阴影|遮罩|手写|无衬线|衬线/i;

  tokens.forEach((token) => {
    const matchesLayout = layoutPattern.test(token);
    const matchesTypography = typographyPattern.test(token);

    if (matchesLayout || !matchesTypography) {
      layoutTokens.push(token);
    }
    if (matchesTypography) {
      typographyTokens.push(token);
    }
  });

  return {
    layout: uniquePhraseList(layoutTokens),
    typography: uniquePhraseList(typographyTokens),
  };
}

function normalizeAnalysis(value: unknown): DesignStructuredAnalysis {
  const source = isRecord(value) ? value : {};
  const analysis: DesignStructuredAnalysis = {
    canvas: normalizeAnalysisSection(getFirstPresentValue(source, [
      "canvas",
      "overall",
      "overallStyle",
      "overall_style",
      "canvasStyle",
      "canvas_style",
    ])),
    subject: normalizeAnalysisSection(getFirstPresentValue(source, [
      "subject",
      "subjects",
      "mainSubject",
      "main_subject",
      "elements",
      "mainElements",
      "main_elements",
    ])),
    background: normalizeAnalysisSection(getFirstPresentValue(source, [
      "background",
      "backgrounds",
      "backgroundLayer",
      "background_layer",
      "backdrop",
    ])),
    layout: normalizeAnalysisSection(getFirstPresentValue(source, [
      "layout",
      "composition",
      "compositionLayout",
      "composition_layout",
    ])),
    typography: normalizeAnalysisSection(getFirstPresentValue(source, [
      "typography",
      "font",
      "fonts",
      "fontStyle",
      "font_style",
      "visualEffects",
      "visual_effects",
    ])),
  };

  const legacyLayoutTypography = normalizeAnalysisSection(getFirstPresentValue(source, [
    "layoutTypography",
    "layout_typography",
  ]));

  if (legacyLayoutTypography.tokens.length > 0 || legacyLayoutTypography.detailText) {
    const split = splitLegacyLayoutTypographyTokens(legacyLayoutTypography.tokens);
    analysis.layout = mergeAnalysisSection(analysis.layout, {
      tokens: split.layout,
      detailText: legacyLayoutTypography.detailText,
    });
    analysis.typography = mergeAnalysisSection(analysis.typography, {
      tokens: split.typography.length > 0 ? split.typography : legacyLayoutTypography.tokens,
      detailText: legacyLayoutTypography.detailText,
    });
  }

  return analysis;
}

function normalizePaletteEntry(value: unknown): DesignStructuredPaletteEntry | null {
  if (typeof value === "string") {
    const hex = extractHexMatches(value)[0] || "";
    if (!hex) {
      return null;
    }
    return {
      hex,
      weight: "",
    };
  }

  const source = isRecord(value) ? value : {};
  const inferredHex = normalizeHex(
    toLooseString(getFirstPresentValue(source, ["hex", "color", "colour", "code"]))
    || toLooseString(Object.keys(source).find((key) => normalizeHex(key)) || "")
  );

  if (!inferredHex) {
    return null;
  }

  return {
    hex: inferredHex,
    weight: toLooseString(getFirstPresentValue(source, ["weight", "ratio", "percentage", "percent", "coverage", "占比"])),
  };
}

function mergePaletteEntries(
  entries: DesignStructuredPaletteEntry[],
  textFallbacks: string[],
) {
  const merged = new Map<string, DesignStructuredPaletteEntry>();

  entries.forEach((entry) => {
    if (!entry.hex) {
      return;
    }
    const existing = merged.get(entry.hex);
    merged.set(entry.hex, {
      hex: entry.hex,
      weight: entry.weight || existing?.weight || "",
    });
  });

  textFallbacks
    .flatMap((text) => extractHexMatches(text))
    .forEach((hex) => {
      if (!merged.has(hex)) {
        merged.set(hex, {
          hex,
          weight: "",
        });
      }
    });

  return Array.from(merged.values());
}

function normalizePalette(
  value: unknown,
  textFallbacks: string[],
) {
  const entries: DesignStructuredPaletteEntry[] = [];

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const entry = normalizePaletteEntry(item);
      if (entry) {
        entries.push(entry);
      }
    });
  } else if (typeof value === "string") {
    entries.push(
      ...extractHexMatches(value).map((hex) => ({
        hex,
        weight: "",
      }))
    );
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, entryValue]) => {
      const normalizedEntry = normalizePaletteEntry(
        isRecord(entryValue) ? { hex: key, ...entryValue } : { hex: key, weight: entryValue }
      );
      if (normalizedEntry) {
        entries.push(normalizedEntry);
      }
    });
  }

  return mergePaletteEntries(entries, textFallbacks).map((entry) => ({
    hex: entry.hex,
    weight: entry.weight.trim(),
  }));
}

function normalizeVariantId(value: unknown, index: number): DesignStructuredVariantId {
  const normalized = toLooseString(value).toLowerCase();
  const matched = normalized.match(/^v?(\d+)$/);
  if (matched) {
    const numericId = `v${matched[1]}`;
    if ((DESIGN_STRUCTURED_VARIANT_IDS as readonly string[]).includes(numericId)) {
      return numericId as DesignStructuredVariantId;
    }
  }
  return DESIGN_STRUCTURED_VARIANT_IDS[index] || DESIGN_STRUCTURED_VARIANT_IDS[0];
}

function createEmptyVariant(variantId: DesignStructuredVariantId, index: number): DesignStructuredVariant {
  return {
    id: variantId,
    label: `版本 ${index + 1}`,
    coreFields: { ...EMPTY_CORE_FIELDS },
    coreSuggestions: { ...EMPTY_CORE_FIELDS },
    palette: [],
    analysis: {
      canvas: { ...EMPTY_ANALYSIS_SECTION },
      subject: { ...EMPTY_ANALYSIS_SECTION },
      background: { ...EMPTY_ANALYSIS_SECTION },
      layout: { ...EMPTY_ANALYSIS_SECTION },
      typography: { ...EMPTY_ANALYSIS_SECTION },
    },
    promptPreview: "",
  };
}

function hasMeaningfulVariantShape(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    "analysis" in value
    || "palette" in value
    || "coreFields" in value
    || "promptPreview" in value
    || "prompt_preview" in value
    || "preview" in value
  );
}

function unwrapStructuredPayload(parsed: unknown) {
  if (!isRecord(parsed)) {
    return parsed;
  }

  if (isRecord(parsed.data) && ("variants" in parsed.data || "v1" in parsed.data)) {
    return parsed.data;
  }

  if (isRecord(parsed.result) && ("variants" in parsed.result || "v1" in parsed.result)) {
    return parsed.result;
  }

  return parsed;
}

function unwrapVariantPayload(parsed: unknown) {
  const payload = unwrapStructuredPayload(parsed);

  if (isRecord(payload)) {
    if (hasMeaningfulVariantShape(payload.variant)) {
      return payload.variant;
    }
    if (isRecord(payload.data) && hasMeaningfulVariantShape(payload.data.variant)) {
      return payload.data.variant;
    }
    if (isRecord(payload.result) && hasMeaningfulVariantShape(payload.result.variant)) {
      return payload.result.variant;
    }
    if (hasMeaningfulVariantShape(payload)) {
      return payload;
    }
  }

  return payload;
}

function normalizeVariantsSource(parsed: unknown): unknown[] {
  const payload = unwrapStructuredPayload(parsed);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const variantsValue = payload.variants;
  if (Array.isArray(variantsValue)) {
    return variantsValue;
  }

  if (isRecord(variantsValue)) {
    return Object.entries(variantsValue).map(([id, value]) => (
      isRecord(value) ? { id, ...value } : { id, value }
    ));
  }

  const directVariants = DESIGN_STRUCTURED_VARIANT_IDS
    .filter((variantId) => variantId in payload)
    .map((variantId) => {
      const value = payload[variantId];
      return isRecord(value) ? { id: variantId, ...value } : { id: variantId, value };
    });

  if (directVariants.length > 0) {
    return directVariants;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return [];
}

function buildAnalysisOnlyPrompt(
  analysis: DesignStructuredAnalysis,
) {
  const sectionPhrases = DESIGN_ANALYSIS_SECTION_KEYS.flatMap((sectionKey) => {
    const section = analysis[sectionKey];
    const parts: string[] = [];
    if (section.detailText.trim()) {
      parts.push(section.detailText.trim());
    }
    if (section.tokens.length > 0) {
      parts.push(`${sectionKey}: ${section.tokens.join(", ")}`);
    }
    return parts;
  });

  return sectionPhrases
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVariant(value: unknown, index: number): DesignStructuredVariant {
  const source = isRecord(value) ? value : {};
  const coreFieldsSource = getFirstPresentValue(source, ["coreFields", "core_fields", "fields", "core"]) ?? source;
  const coreSuggestionsSource = getFirstPresentValue(source, ["coreSuggestions", "core_suggestions", "suggestions"]) ?? {};
  const analysisSource = getFirstPresentValue(source, ["analysis", "analysisSections", "analysis_sections", "advanced", "details", "structure", "groups"]) ?? source;
  const promptPreview = toLooseString(getFirstPresentValue(source, ["promptPreview", "prompt_preview", "preview", "finalPrompt", "final_prompt"]));
  const label = toLooseString(getFirstPresentValue(source, ["label", "name", "title"])) || `版本 ${index + 1}`;
  const analysis = normalizeAnalysis(analysisSource);
  const normalizedPalette = normalizePalette(
    getFirstPresentValue(source, ["palette", "colors", "colorPalette", "colourPalette", "colorSystem", "colourSystem"]),
    [
      promptPreview,
      analysis.canvas.detailText,
      analysis.subject.detailText,
      analysis.background.detailText,
      analysis.layout.detailText,
      analysis.typography.detailText,
    ],
  );
  const palette = derivePaletteFromVariantContent({
    analysis,
    promptPreview,
    existingPalette: normalizedPalette,
  });

  return {
    id: normalizeVariantId(getFirstPresentValue(source, ["id", "variantId", "variant_id", "key"]), index),
    label,
    coreFields: normalizeCoreFields(coreFieldsSource),
    coreSuggestions: normalizeCoreFields(coreSuggestionsSource),
    palette,
    analysis,
    promptPreview: promptPreview || buildAnalysisOnlyPrompt(analysis),
  };
}

function normalizeSourceType(
  value: unknown,
  variants: DesignStructuredVariant[],
): DesignStructuredSourceType {
  const normalized = toLooseString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized && SOURCE_TYPE_ALIASES[normalized]) {
    return SOURCE_TYPE_ALIASES[normalized];
  }

  const hasKvCoreFields = variants.some((variant) => (
    Object.values(variant.coreFields).some((field) => field.trim())
  ));

  return hasKvCoreFields ? "kv_shortcut" : "image_reverse";
}

function hasMeaningfulVariantContent(variant: DesignStructuredVariant, index: number) {
  return (
    (variant.label.trim() && variant.label.trim() !== `版本 ${index + 1}`)
    || Object.values(variant.coreFields).some((value) => value.trim())
    || Object.values(variant.coreSuggestions).some((value) => value.trim())
    || variant.palette.length > 0
    || DESIGN_ANALYSIS_SECTION_KEYS.some((sectionKey) => (
      variant.analysis[sectionKey].tokens.length > 0
      || variant.analysis[sectionKey].detailText.trim()
    ))
    || variant.promptPreview.trim()
  );
}

export function isKvShortcutId(shortcutId: PlaygroundShortcut["id"]): shortcutId is KvShortcutId {
  return (KV_SHORTCUT_IDS as readonly string[]).includes(shortcutId);
}

export function getKvCoreFieldsFromValues(values: ShortcutPromptValues): DesignStructuredCoreFields {
  return {
    mainTitle: values.mainTitle || "",
    subTitle: values.subTitle || "",
    eventTime: values.eventTime || "",
    style: values.style || "",
    primaryColor: values.primaryColor || "",
  };
}

export function buildKvStructuredOptimizationInput(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
) {
  if (!isKvShortcutId(shortcut.id)) {
    throw new Error(`Shortcut ${shortcut.id} is not a KV shortcut`);
  }

  return buildShortcutPrompt(shortcut, values, {
    removedFieldIds,
    usePlaceholder: false,
  });
}

export function parseDesignStructuredOptimizationResponse(raw: string): DesignStructuredVariantsResponse {
  const parsed = unwrapStructuredPayload(parseJsonCandidate(raw));
  const normalizedVariants = normalizeVariantsSource(parsed).map((variant, index) => normalizeVariant(variant, index));
  const finalVariants = DESIGN_STRUCTURED_VARIANT_IDS.map((variantId, index) => {
    const matchedVariant = normalizedVariants.find((variant) => variant.id === variantId);
    return matchedVariant || createEmptyVariant(variantId, index);
  });

  if (!normalizedVariants.some((variant, index) => hasMeaningfulVariantContent(variant, index))) {
    throw new Error("Structured optimization response did not contain any usable variants");
  }

  const payload = isRecord(parsed) ? parsed : {};
  const sourceType = normalizeSourceType(payload.sourceType, finalVariants);

  return {
    mode: DESIGN_STRUCTURED_MODE,
    sourceType,
    variants: finalVariants.map((variant, index) => ({
      id: variant.id,
      label: variant.label.trim() || `版本 ${index + 1}`,
      coreFields: {
        mainTitle: variant.coreFields.mainTitle.trim(),
        subTitle: variant.coreFields.subTitle.trim(),
        eventTime: variant.coreFields.eventTime.trim(),
        style: variant.coreFields.style.trim(),
        primaryColor: variant.coreFields.primaryColor.trim(),
      },
      coreSuggestions: {
        mainTitle: variant.coreSuggestions.mainTitle.trim(),
        subTitle: variant.coreSuggestions.subTitle.trim(),
        eventTime: variant.coreSuggestions.eventTime.trim(),
        style: variant.coreSuggestions.style.trim(),
        primaryColor: variant.coreSuggestions.primaryColor.trim(),
      },
      palette: normalizeDesignPalette(variant.palette),
      analysis: {
        canvas: {
          tokens: uniquePhraseList(variant.analysis.canvas.tokens),
          detailText: variant.analysis.canvas.detailText.trim(),
        },
        subject: {
          tokens: uniquePhraseList(variant.analysis.subject.tokens),
          detailText: variant.analysis.subject.detailText.trim(),
        },
        background: {
          tokens: uniquePhraseList(variant.analysis.background.tokens),
          detailText: variant.analysis.background.detailText.trim(),
        },
        layout: {
          tokens: uniquePhraseList(variant.analysis.layout.tokens),
          detailText: variant.analysis.layout.detailText.trim(),
        },
        typography: {
          tokens: uniquePhraseList(variant.analysis.typography.tokens),
          detailText: variant.analysis.typography.detailText.trim(),
        },
      },
      promptPreview: variant.promptPreview.trim() || buildAnalysisOnlyPrompt(variant.analysis),
    })),
  };
}

export const parseKvStructuredOptimizationResponse = parseDesignStructuredOptimizationResponse;

export function parseDesignStructuredVariantEditResponse(raw: string): DesignStructuredVariantEditResponse {
  const parsed = unwrapVariantPayload(parseJsonCandidate(raw));
  const directVariant = normalizeVariant(parsed, 0);

  if (hasMeaningfulVariantContent(directVariant, 0)) {
    return {
      mode: DESIGN_VARIANT_EDIT_MODE,
      variant: {
        ...directVariant,
        label: directVariant.label.trim() || "版本 1",
        coreFields: {
          mainTitle: directVariant.coreFields.mainTitle.trim(),
          subTitle: directVariant.coreFields.subTitle.trim(),
          eventTime: directVariant.coreFields.eventTime.trim(),
          style: directVariant.coreFields.style.trim(),
          primaryColor: directVariant.coreFields.primaryColor.trim(),
        },
        coreSuggestions: {
          mainTitle: directVariant.coreSuggestions.mainTitle.trim(),
          subTitle: directVariant.coreSuggestions.subTitle.trim(),
          eventTime: directVariant.coreSuggestions.eventTime.trim(),
          style: directVariant.coreSuggestions.style.trim(),
          primaryColor: directVariant.coreSuggestions.primaryColor.trim(),
        },
        palette: normalizeDesignPalette(directVariant.palette),
        analysis: {
          canvas: {
            tokens: uniquePhraseList(directVariant.analysis.canvas.tokens),
            detailText: directVariant.analysis.canvas.detailText.trim(),
          },
          subject: {
            tokens: uniquePhraseList(directVariant.analysis.subject.tokens),
            detailText: directVariant.analysis.subject.detailText.trim(),
          },
          background: {
            tokens: uniquePhraseList(directVariant.analysis.background.tokens),
            detailText: directVariant.analysis.background.detailText.trim(),
          },
          layout: {
            tokens: uniquePhraseList(directVariant.analysis.layout.tokens),
            detailText: directVariant.analysis.layout.detailText.trim(),
          },
          typography: {
            tokens: uniquePhraseList(directVariant.analysis.typography.tokens),
            detailText: directVariant.analysis.typography.detailText.trim(),
          },
        },
        promptPreview: directVariant.promptPreview.trim() || buildAnalysisOnlyPrompt(directVariant.analysis),
      },
    };
  }

  const variantsPayload = parseDesignStructuredOptimizationResponse(raw);
  return {
    mode: DESIGN_VARIANT_EDIT_MODE,
    variant: variantsPayload.variants[0],
  };
}

export function assembleDesignStructuredShortcutPrompt(
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  removedFieldIds: string[],
  analysis: DesignStructuredAnalysis,
  palette: DesignStructuredPaletteEntry[] = [],
) {
  void shortcut;
  void values;
  void removedFieldIds;
  void palette;
  return buildAnalysisOnlyPrompt(analysis);
}

export const assembleKvStructuredPrompt = assembleDesignStructuredShortcutPrompt;

export function getKvShortcutMarket(shortcutId: KvShortcutId): string {
  return KV_SHORTCUT_MARKET_MAP[shortcutId];
}

export function buildDesignSectionDetailSyncInstruction(params: {
  sectionKey: DesignAnalysisSectionKey;
  section: DesignStructuredAnalysisSection;
}) {
  const normalizedTokens = params.section.tokens
    .map((token) => token.trim())
    .filter(Boolean);
  const originalDetailText = params.section.detailText.trim() || "（当前为空）";

  return [
    `请只更新 ${params.sectionKey} section 的 detailText，并严格保留当前 tokens 原样不变。`,
    "新的 detailText 必须完整吸收这些 tokens 表达的重点，并尽量延续原始 detailText 的细节密度、语气和具体程度。",
    "不要改动其他 section，不要改 coreFields，也不要把 detailText 退化成 tokens 的简单罗列。",
    `当前 tokens（必须原样保留）: ${JSON.stringify(normalizedTokens)}`,
    `原始 detailText: ${originalDetailText}`,
    "请输出完整 variant JSON，但只有当前 section 的 detailText 需要被显著更新。",
  ].join("\n");
}

export function buildDesignVariantEditUserInput(params: {
  instruction: string;
  scope: DesignVariantEditScope;
  variant: DesignStructuredVariant;
  context: {
    shortcutId: string;
    shortcutPrompt: string;
    market?: string;
  };
}) {
  return JSON.stringify(
    {
      task: "design_structured_variant_edit_v1",
      scope: params.scope,
      instruction: params.instruction.trim(),
      context: params.context,
      currentVariant: {
        id: params.variant.id,
        label: params.variant.label,
        coreFields: params.variant.coreFields,
        coreSuggestions: params.variant.coreSuggestions,
        analysis: params.variant.analysis,
        promptPreview: params.variant.promptPreview,
      },
    },
    null,
    2,
  );
}
