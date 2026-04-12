import { NextRequest } from 'next/server';
import { attachSessionCookie, getOrCreateSession } from '@/lib/server/auth/session';
import { getServerServices } from '@/lib/server/container';
import { errorResponse, jsonResponse, queryRecord, readJsonBody } from '@/lib/server/http';
import type { SortBy } from '@/lib/server/service/history.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { historyService } = await getServerServices();
    const params = queryRecord(request.nextUrl.searchParams);
    const resolution = await getOrCreateSession();
    const isPrivateHistory = params.mine === '1' || typeof params.userId === 'string';
    const hasDetailLookup = typeof params.id === 'string' || typeof params.outputUrl === 'string';

    const payload = hasDetailLookup
      ? await historyService.getHistoryDetail({
        id: typeof params.id === 'string' ? params.id : null,
        outputUrl: typeof params.outputUrl === 'string' ? params.outputUrl : null,
        userId: isPrivateHistory ? resolution.session.actorId : null,
        viewerUserId: resolution.session.actorId,
      })
      : await historyService.getHistory({
        ...params,
        userId: isPrivateHistory ? resolution.session.actorId : null,
        sortBy: (params.sortBy as SortBy) || 'recent',
        viewerUserId: resolution.session.actorId,
      } as never);

    const response = jsonResponse(payload);

    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { historyService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const response = jsonResponse(await historyService.saveHistory(
      await readJsonBody(request),
      resolution.session.actorId,
    ));

    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { historyService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const body = await readJsonBody<{ ids?: string[] }>(request);
    const response = jsonResponse(await historyService.deleteHistory(
      body.ids || [],
      resolution.session.actorId,
    ));

    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
