import { attachSessionCookie, getOrCreateSession } from '@/lib/server/auth/session';
import { getServerServices } from '@/lib/server/container';
import { errorResponse, jsonResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const { projectId } = await context.params;
    const response = jsonResponse(await infiniteCanvasService.duplicateProject(
      resolution.session.actorId,
      projectId,
    ));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
