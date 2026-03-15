import { getServerServices } from '@/lib/server/container';
import { handleRoute, streamResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return handleRoute(async () => {
    const { datasetSyncService } = await getServerServices();
    return streamResponse(datasetSyncService.createSyncStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });
}
