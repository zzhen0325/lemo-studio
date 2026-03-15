import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return handleRoute(async () => {
    const { presetCategoriesService } = await getServerServices();
    return presetCategoriesService.getCategories();
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { presetCategoriesService } = await getServerServices();
    return presetCategoriesService.saveCategories(await readJsonBody<string[]>(request));
  });
}
