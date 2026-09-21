import { isLocalRuntime } from '@/lib/server/local-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json(
    {
      ok: true,
      runtime: isLocalRuntime() ? 'local' : 'coze',
      service: 'lemon8-ai-studio',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
