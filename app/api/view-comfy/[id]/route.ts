import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { viewComfyConfigService } = await getServerServices();
    const { id } = await context.params;
    return viewComfyConfigService.getWorkflowById(id);
  });
}

export async function PUT(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { viewComfyConfigService } = await getServerServices();
    const { id } = await context.params;
    return viewComfyConfigService.updateWorkflow(
      id,
      await readJsonBody<{ viewComfyJSON: Record<string, unknown>; workflowApiJSON: Record<string, unknown> }>(request),
    );
  });
}
