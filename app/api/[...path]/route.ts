import { NextRequest, NextResponse } from 'next/server';
import { normalizeConfiguredApiBase } from '@/lib/api-base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function resolveInternalApiBase(): URL {
  const base = normalizeConfiguredApiBase(process.env.GULUX_API_BASE)
    || normalizeConfiguredApiBase(process.env.INTERNAL_API_BASE)
    || 'http://127.0.0.1:3000/api';

  return new URL(base);
}

function buildTargetUrl(request: NextRequest): URL {
  const base = resolveInternalApiBase();
  const proxiedPath = request.nextUrl.pathname.replace(/^\/api/, '');

  base.pathname = `${base.pathname.replace(/\/$/, '')}${proxiedPath}`;
  base.search = request.nextUrl.search;
  return base;
}

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  // Avoid upstream compression because Node fetch transparently decodes
  // the response body. Forwarding a decoded body with the original
  // content-encoding header breaks browser/curl decoding.
  headers.set('accept-encoding', 'identity');
  headers.set('x-forwarded-host', request.headers.get('x-forwarded-host') || request.nextUrl.host);
  headers.set('x-forwarded-proto', request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', ''));

  return headers;
}

function buildDownstreamHeaders(response: Response): Headers {
  const headers = new Headers(response.headers);

  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }

  return headers;
}

function shouldForwardBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const targetUrl = buildTargetUrl(request);

  try {
    const upstreamInit: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers: buildUpstreamHeaders(request),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(300_000),
    };

    if (shouldForwardBody(request.method)) {
      upstreamInit.body = request.body;
      upstreamInit.duplex = 'half';
    }

    const upstreamResponse = await fetch(targetUrl, upstreamInit);

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: buildDownstreamHeaders(upstreamResponse),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API Proxy] Request failed:', request.method, targetUrl.toString(), message);
    return NextResponse.json(
      { error: `Proxy error: ${message}` },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyRequest(request);
}
