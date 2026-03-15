import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryValue, readJsonBody } from '@/lib/server/http';
import type { ViewComfyConfigPayload } from '@/lib/server/service/view-comfy.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { viewComfyConfigService } = await getServerServices();
    return viewComfyConfigService.getConfig(queryValue(request, 'lightweight') === 'true');
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { viewComfyConfigService } = await getServerServices();
    return viewComfyConfigService.saveConfig(await readJsonBody<ViewComfyConfigPayload>(request));
  });
}
