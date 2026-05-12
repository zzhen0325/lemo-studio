import { AIProviderError } from "../provider-errors";

const CONTENT_MODERATION_MESSAGE =
  "内容审核未通过：提示词或参考图可能包含敏感或不合规内容，请调整后重试。";

function parseJson(raw: string): unknown {
  if (!raw.trim()) return "";

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function stringifyForSearch(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function containsContentModerationSignal(value: string): boolean {
  return /InputTextSensitiveContentDet|SensitiveContentDet|sensitive\s*content|内容审核|敏感内容/i.test(value);
}

function extractUpstreamCode(parsed: unknown, raw: string): string | undefined {
  const directMatch = raw.match(/InputTextSensitiveContentDet|[A-Za-z]+SensitiveContentDet/i);
  if (directMatch) return directMatch[0];

  if (!parsed || typeof parsed !== "object") return undefined;

  const queue: unknown[] = [parsed];
  const visited = new Set<unknown>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of ["code", "error_code"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }

    queue.push(...Object.values(record));
  }

  return undefined;
}

export function createCozeWorkflowHttpError(params: {
  status: number;
  raw: string;
}): Error {
  const parsed = parseJson(params.raw);
  const searchable = `${params.raw}\n${stringifyForSearch(parsed)}`;

  if (containsContentModerationSignal(searchable)) {
    return new AIProviderError(CONTENT_MODERATION_MESSAGE, {
      status: 400,
      code: "CONTENT_MODERATION_REJECTED",
      provider: "coze-workflow",
      details: {
        upstreamStatus: params.status,
        upstreamCode: extractUpstreamCode(parsed, params.raw),
      },
    });
  }

  const truncatedError =
    params.raw.length > 500 ? `${params.raw.slice(0, 500)}...` : params.raw;
  return new Error(`Coze Seed workflow API Error: ${params.status} - ${truncatedError}`);
}
