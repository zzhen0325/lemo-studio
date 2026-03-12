type UnknownRecord = Record<string, unknown>;

export type ExtractedErrorInfo = {
  message: string;
  details: string[];
};

const GENERIC_MESSAGES = new Set([
  "bad gateway",
  "error",
  "gateway timeout",
  "internal server error",
  "request failed",
  "something went wrong",
  "unknown error",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pushUnique(target: string[], value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized || target.includes(normalized)) return;
  target.push(normalized);
}

function isGenericMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_MESSAGES.has(normalized)) return true;
  if (/^http\s+\d+$/i.test(normalized)) return true;
  if (/^status\s+\d+$/i.test(normalized)) return true;
  return false;
}

function collectNodeErrorMessages(nodeErrors: unknown, target: string[]) {
  if (!isRecord(nodeErrors)) return;

  for (const [nodeId, value] of Object.entries(nodeErrors)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!isRecord(item)) continue;
      const message = normalizeText(item.message);
      const type = normalizeText(item.type);
      if (message && type) {
        pushUnique(target, `Node ${nodeId} (${type}): ${message}`);
        continue;
      }
      if (message) {
        pushUnique(target, `Node ${nodeId}: ${message}`);
        continue;
      }
      if (type) {
        pushUnique(target, `Node ${nodeId}: ${type}`);
      }
    }
  }
}

function collectMessages(value: unknown, target: string[], seen: Set<unknown>, depth: number) {
  if (value == null || depth > 4) return;

  if (typeof value === "string") {
    pushUnique(target, value);
    return;
  }

  if (value instanceof Error) {
    pushUnique(target, value.message);
    collectMessages((value as Error & { cause?: unknown }).cause, target, seen, depth + 1);
    collectMessages((value as Error & { details?: unknown }).details, target, seen, depth + 1);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectMessages(item, target, seen, depth + 1);
    }
    return;
  }

  if (!isRecord(value) || seen.has(value)) return;
  seen.add(value);

  const directKeys = ["errorMsg", "error", "message", "detail", "msg", "statusText"] as const;
  for (const key of directKeys) {
    collectMessages(value[key], target, seen, depth + 1);
  }

  collectMessages(value.errorDetails, target, seen, depth + 1);
  collectMessages(value.errors, target, seen, depth + 1);
  collectMessages(value.details, target, seen, depth + 1);
  collectMessages(value.cause, target, seen, depth + 1);
  collectNodeErrorMessages(value.node_errors, target);
  collectNodeErrorMessages(value.nodeErrors, target);
}

export function extractErrorInfo(input: unknown, fallback = "Request failed"): ExtractedErrorInfo {
  const messages: string[] = [];
  collectMessages(input, messages, new Set<unknown>(), 0);

  const primary =
    messages.find((message) => !isGenericMessage(message))
    || messages[0]
    || fallback;

  return {
    message: primary,
    details: messages.filter((message) => message !== primary),
  };
}

export function extractErrorMessage(input: unknown, fallback = "Request failed"): string {
  return extractErrorInfo(input, fallback).message;
}

export function toDisplayError(input: unknown, fallback = "Request failed"): Error {
  const info = extractErrorInfo(input, fallback);
  const error = input instanceof Error ? input : new Error(info.message);

  if (error.message !== info.message) {
    error.message = info.message;
  }

  const enriched = error as Error & {
    details?: unknown;
    errorDetails?: string[];
    status?: number;
  };

  if (input !== error) {
    enriched.details = input;
  } else if (enriched.details === undefined && isRecord(input) && "details" in input) {
    enriched.details = input.details;
  }

  if (info.details.length > 0) {
    enriched.errorDetails = info.details;
  }

  if (isRecord(input) && typeof input.status === "number") {
    enriched.status = input.status;
  }

  return error;
}

export function parseErrorPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
