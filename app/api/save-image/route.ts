import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import type { SaveImageRequestBody } from '@/lib/server/service/save-image.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { saveImageService } = await getServerServices();
    return saveImageService.save(await readJsonBody<SaveImageRequestBody>(request));
  });
}
