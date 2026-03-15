import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryValue, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { StyleStack } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return handleRoute(async () => {
    const { stylesService } = await getServerServices();
    return stylesService.listStyles();
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { stylesService } = await getServerServices();
    return stylesService.saveStyle(await readJsonBody<StyleStack>(request));
  });
}

export async function DELETE(request: NextRequest) {
  return handleRoute(async () => {
    const { stylesService } = await getServerServices();
    const id = queryValue(request, 'id');
    if (!id) {
      throw new HttpError(400, 'Missing ID');
    }
    await stylesService.deleteStyle(id);
    return { success: true };
  });
}
