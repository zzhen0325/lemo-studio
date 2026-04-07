import { NextRequest } from 'next/server';
import { binaryResponse, handleRoute, queryValue } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const url = queryValue(request, 'url');
    if (!url) {
      throw new HttpError(400, 'url is required');
    }

    const response = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new HttpError(response.status, `Failed to fetch image: ${response.statusText}`);
    }

    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    const etag = response.headers.get('etag');
    if (etag) headers.set('ETag', etag);
    const lastModified = response.headers.get('last-modified');
    if (lastModified) headers.set('Last-Modified', lastModified);
    const contentLength = response.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');

    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      return binaryResponse(Buffer.from(arrayBuffer), { headers });
    }
    return new Response(response.body, { headers });
  });
}
