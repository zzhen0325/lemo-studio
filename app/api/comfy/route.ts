import { getServerServices } from '@/lib/server/container';
import { binaryResponse, handleRoute } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { comfyService } = await getServerServices();
    const logId = request.headers.get('x-tt-logid') || request.headers.get('X-TT-LOGID') || undefined;
    const stream = await comfyService.runWorkflowFromFormData(await request.formData(), logId);
    return binaryResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=\"generated_images.bin\"',
      },
    });
  });
}
