import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryValue } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return handleRoute(async () => {
    const { presetsService } = await getServerServices();
    return presetsService.listPresets();
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { presetsService } = await getServerServices();
    return presetsService.savePresetFromFormData(await request.formData());
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const { presetsService } = await getServerServices();
    const id = queryValue(request, 'id');
    if (!id) {
      throw new HttpError(400, 'Missing ID');
    }
    await presetsService.deletePreset(id);
    return { success: true };
  });
}
