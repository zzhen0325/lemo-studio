import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import {
  handleRoute,
  queryRecord,
  readJsonBody,
} from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function buildFormPayload(formData: FormData) {
  const body: Record<string, unknown> = {};
  const files: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const current = files[key];
      if (current === undefined) {
        files[key] = value;
      } else if (Array.isArray(current)) {
        current.push(value);
      } else {
        files[key] = [current, value];
      }
      continue;
    }

    const current = body[key];
    if (current === undefined) {
      body[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      body[key] = [current, value];
    }
  }

  return { body, files };
}

async function requestBodyAndFiles(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return buildFormPayload(await request.formData());
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    return { body: undefined, files: undefined };
  }

  if (contentType.includes('application/json')) {
    return { body: await readJsonBody(request), files: undefined };
  }

  const text = await request.text();
  return { body: text || undefined, files: undefined };
}

async function proxy(request: NextRequest) {
  const { comfyProxyService } = await getServerServices();
  const { body, files } = await requestBodyAndFiles(request);
  const query = queryRecord(request.nextUrl.searchParams);
  const apiKey =
    request.headers.get('x-comfy-api-key') ||
    (typeof query.apiKey === 'string' ? query.apiKey : undefined) ||
    (typeof query.comfyApiKey === 'string' ? query.comfyApiKey : undefined) ||
    undefined;
  const authorization = request.headers.get('authorization') || undefined;
  const pathValue = query.path;
  const path = Array.isArray(pathValue) ? pathValue[0] : pathValue;

  const response = await comfyProxyService.proxyRequest({
    method: request.method,
    path,
    query,
    body,
    files,
    apiKey,
    authorization,
  });

  const headers = new Headers();
  for (const [key, value] of response.headers.entries()) {
    const lower = key.toLowerCase();
    if ([
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
    ].includes(lower)) {
      continue;
    }
    headers.set(key, value);
  }

  if (!response.body) {
    return new Response(null, {
      status: response.status,
      headers,
    });
  }

  return new Response(response.body as BodyInit, {
    status: response.status,
    headers,
  });
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => proxy(request));
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => proxy(request));
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => proxy(request));
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => proxy(request));
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => proxy(request));
}
