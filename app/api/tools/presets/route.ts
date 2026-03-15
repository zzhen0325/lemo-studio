import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryValue } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { toolsPresetsService } = await getServerServices();
    const toolId = queryValue(request, 'toolId');
    if (!toolId) {
      throw new HttpError(400, 'Missing toolId');
    }
    return toolsPresetsService.listPresets(toolId);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { toolsPresetsService } = await getServerServices();
    return toolsPresetsService.savePresetFromFormData(await request.formData());
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const { toolsPresetsService } = await getServerServices();
    const id = queryValue(request, 'id');
    const toolId = queryValue(request, 'toolId');
    if (!id || !toolId) {
      throw new HttpError(400, 'Missing id or toolId');
    }
    await toolsPresetsService.deletePreset(toolId, id);
    return { success: true };
  });
}
