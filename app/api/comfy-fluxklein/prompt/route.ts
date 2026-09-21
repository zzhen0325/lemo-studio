import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { comfyFluxKleinService } = await getServerServices();
    const logId = request.headers.get('x-tt-logid') || request.headers.get('X-TT-LOGID');
    const requestId = request.headers.get('x-request-id') || request.headers.get('X-REQUEST-ID');
    const traceId = requestId || logId || undefined;
    const result = await comfyFluxKleinService.preparePromptFromBody(
      await readJsonBody<Record<string, unknown>>(request),
      traceId,
    );

    return { prompt: result.prompt };
  });
}
