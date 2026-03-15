import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { InfiniteCanvasProject } from '@/types/infinite-canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { infiniteCanvasService } = await getServerServices();
    const { projectId } = await context.params;
    return infiniteCanvasService.getProject(projectId);
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { infiniteCanvasService } = await getServerServices();
    const { projectId } = await context.params;
    return infiniteCanvasService.saveProject(projectId, await readJsonBody<InfiniteCanvasProject>(request));
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { infiniteCanvasService } = await getServerServices();
    const { projectId } = await context.params;
    const body = await readJsonBody<{ projectName?: string }>(request);
    const projectName = body.projectName?.trim();
    if (!projectName) {
      throw new HttpError(400, 'projectName is required');
    }
    return infiniteCanvasService.renameProject(projectId, projectName);
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { infiniteCanvasService } = await getServerServices();
    const { projectId } = await context.params;
    return infiniteCanvasService.deleteProject(projectId);
  });
}
