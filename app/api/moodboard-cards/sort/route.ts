import { handleRoute } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const moodboardCardsService = new MoodboardCardsService();

/**
 * POST /api/moodboard-cards/sort
 * 批量更新排序
 * Body: { orders: Array<{ id: string; sortOrder: number }> }
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json();
    
    if (!body.orders || !Array.isArray(body.orders)) {
      throw new HttpError(400, 'Invalid orders array');
    }

    await moodboardCardsService.updateSortOrder(body.orders);
    return { success: true };
  });
}
