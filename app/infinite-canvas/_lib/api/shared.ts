import { getApiBase } from '@/lib/api-base';
import { parseErrorPayload, toDisplayError } from '@/lib/error-message';

export type RequestConfig = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

export function cleanupUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, candidate]) => candidate !== undefined)) as T;
}

export async function requestJSON<T>(url: string, config: RequestConfig = {}): Promise<T> {
  const apiBase = getApiBase();
  const fullUrl = url.startsWith('/') ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  
  const response = await fetch(fullUrl, {
    method: config.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
    signal: config.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw toDisplayError(parseErrorPayload(text), `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}
