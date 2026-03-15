import { NextRequest, NextResponse } from 'next/server';
import { HttpError } from './utils/http-error';

type QueryValue = string | string[] | undefined;

export function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }

  return NextResponse.json(data, {
    ...init,
    headers,
  });
}

export function binaryResponse(body: BodyInit, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }

  return new Response(body, {
    ...init,
    headers,
  });
}

export function streamResponse(stream: BodyInit | null, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }

  return new Response(stream, {
    ...init,
    headers,
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  console.error('[Next API] Unhandled error:', error);
  return jsonResponse({ error: message }, { status: 500 });
}

export async function handleRoute(
  handler: () => Promise<Response | NextResponse | unknown>,
) {
  try {
    const result = await handler();
    if (result instanceof Response) {
      return result;
    }
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}

export function queryRecord(searchParams: URLSearchParams): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {};

  for (const [key, value] of searchParams.entries()) {
    const current = query[key];
    if (current === undefined) {
      query[key] = value;
      continue;
    }

    if (Array.isArray(current)) {
      current.push(value);
      continue;
    }

    query[key] = [current, value];
  }

  return query;
}

export function queryValue(request: NextRequest, key: string): string | undefined {
  const values = request.nextUrl.searchParams.getAll(key);
  return values[0] || undefined;
}

export function formValueAsString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function fileValue(value: FormDataEntryValue | null): File | null {
  return value instanceof File ? value : null;
}

export function fileValues(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((entry): entry is File => entry instanceof File);
}
