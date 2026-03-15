import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import type { TranslateRequestBody } from '@/lib/server/service/translate.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { translateService } = await getServerServices();
    return translateService.translate(await readJsonBody<TranslateRequestBody>(request));
  });
}
