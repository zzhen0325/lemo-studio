import { NextRequest } from 'next/server';

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function buildBaseUrl() {
  let url = process.env.COMFYUI_API_URL || '127.0.0.1:8188';
  let secure = false;
  if (url.startsWith('https://')) {
    secure = true;
    url = url.replace('https://', '');
  } else if (url.startsWith('http://')) {
    secure = false;
    url = url.replace('http://', '');
  } else {
    secure = process.env.COMFYUI_SECURE === 'true';
  }
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return `${secure ? 'https://' : 'http://'}${url}`;
}

function buildTargetUrl(request: NextRequest, pathParam?: string[]) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams);
  const baseUrl = buildBaseUrl();
  const queryPath = searchParams.get('path') || undefined;
  searchParams.delete('comfyUrl');
  searchParams.delete('path');
  searchParams.delete('apiKey');
  searchParams.delete('comfyApiKey');
  const rawPath = pathParam && pathParam.length > 0 ? `/${pathParam.join('/')}` : queryPath || '/';
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const target = new URL(normalizedPath, baseUrl);
  const search = searchParams.toString();
  if (search) {
    target.search = search;
  }
  return target.toString();
}

async function handleProxy(request: NextRequest, params?: { path?: string[] }) {
  const targetUrl = buildTargetUrl(request, params?.path);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  const apiKey = request.headers.get('x-comfy-api-key') || request.nextUrl.searchParams.get('apiKey') || request.nextUrl.searchParams.get('comfyApiKey') || undefined;
  if (apiKey && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${apiKey}`);
  }
  headers.delete('x-comfy-api-key');

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : request.body;
  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    duplex: body ? 'half' : undefined,
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleProxy(request, context.params);
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleProxy(request, context.params);
}

export async function PUT(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleProxy(request, context.params);
}

export async function PATCH(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleProxy(request, context.params);
}

export async function DELETE(request: NextRequest, context: { params: { path?: string[] } }) {
  return handleProxy(request, context.params);
}
