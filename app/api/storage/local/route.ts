import { readLocalStorageAsset } from '@/lib/server/service/local-storage.service';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { buffer, contentType } = await readLocalStorageAsset(new URL(request.url).searchParams.get('key'));
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Storage read failed' }, {
      status: error instanceof HttpError ? error.status : 500,
    });
  }
}
