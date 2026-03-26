import { getProxyAgent } from '@/lib/ai/utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractCozeRunText(payload: unknown): string {
  const preferredKeys = [
    'text',
    'output_text',
    'output',
    'result',
    'answer',
    'content',
    'message',
    'response',
    'data',
  ];

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  let fallbackUrl = '';

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === 'string') {
      const value = current.trim();
      if (!value) continue;

      if (/^https?:\/\//i.test(value) && !fallbackUrl) {
        fallbackUrl = value;
        continue;
      }

      return value;
    }

    if (typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === 'string' || typeof value === 'object') {
        queue.unshift(value);
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'string' || typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return fallbackUrl;
}

export async function callCozeRunApi(params: {
  runUrl: string;
  apiToken: string;
  userInput: string;
  systemPrompt: string;
}): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiToken}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    user_input: params.userInput,
    system_prompt: params.systemPrompt,
  });

  const agent = getProxyAgent();
  const fetchOptions: RequestInit & { agent?: unknown } = {
    method: 'POST',
    headers,
    body,
  };

  if (agent) {
    fetchOptions.agent = agent;
  }

  const response = await fetch(params.runUrl, fetchOptions);
  const raw = await response.text();

  if (!response.ok) {
    const truncated = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
    throw new Error(`Coze Run API Error: ${response.status} - ${truncated}`);
  }

  const normalizedRaw = raw.trim();
  if (!normalizedRaw) {
    throw new Error('Coze Run API returned empty body');
  }

  let parsed: unknown = normalizedRaw;
  try {
    parsed = JSON.parse(normalizedRaw);
  } catch {
    parsed = normalizedRaw;
  }

  if (typeof parsed === 'string') {
    return parsed.trim();
  }

  if (isRecord(parsed) || Array.isArray(parsed)) {
    const extracted = extractCozeRunText(parsed).trim();
    if (extracted) {
      return extracted;
    }
  }

  throw new Error(`Coze Run API returned no usable text: ${normalizedRaw.slice(0, 500)}`);
}
