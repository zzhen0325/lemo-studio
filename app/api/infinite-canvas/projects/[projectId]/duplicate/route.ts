import { getServerServices } from '@/lib/server/container';
import { handleRoute } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { infiniteCanvasService } = await getServerServices();
    const { projectId } = await context.params;
    return infiniteCanvasService.duplicateProject(projectId);
  });
}
