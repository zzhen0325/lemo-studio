import { attachSessionCookie, getOrCreateSession } from '@/lib/server/auth/session';
import { getServerServices } from '@/lib/server/container';
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { InfiniteCanvasProject } from '@/types/infinite-canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const { projectId } = await context.params;
    const response = jsonResponse(await infiniteCanvasService.getProject(resolution.session.actorId, projectId));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const { projectId } = await context.params;
    const response = jsonResponse(await infiniteCanvasService.saveProject(
      resolution.session.actorId,
      projectId,
      await readJsonBody<InfiniteCanvasProject>(request),
    ));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const { projectId } = await context.params;
    const body = await readJsonBody<{ projectName?: string }>(request);
    const projectName = body.projectName?.trim();
    if (!projectName) {
      throw new HttpError(400, 'projectName is required');
    }
    const response = jsonResponse(await infiniteCanvasService.renameProject(
      resolution.session.actorId,
      projectId,
      projectName,
    ));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { infiniteCanvasService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const { projectId } = await context.params;
    const response = jsonResponse(await infiniteCanvasService.deleteProject(resolution.session.actorId, projectId));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
