import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryRecord, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { historyService } = await getServerServices();
    return historyService.getHistory(queryRecord(request.nextUrl.searchParams) as never);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { historyService } = await getServerServices();
    return historyService.saveHistory(await readJsonBody(request));
  });
}

export async function DELETE(request: Request) {
  return handleRoute(async () => {
    const { historyService } = await getServerServices();
    const body = await readJsonBody<{ ids?: string[] }>(request);
    return historyService.deleteHistory(body.ids || []);
  });
}
