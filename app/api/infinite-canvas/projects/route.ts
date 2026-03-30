import { attachSessionCookie, getOrCreateSession } from '@/lib/server/auth/session';
import { getServerServices } from '@/lib/server/container';
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const response = jsonResponse(await infiniteCanvasService.listProjects(resolution.session.actorId));
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
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const response = jsonResponse(await infiniteCanvasService.createProject(
      resolution.session.actorId,
      await readJsonBody<{ projectName?: string }>(request),
    ));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
