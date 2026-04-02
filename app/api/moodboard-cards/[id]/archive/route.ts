import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const moodboardCardsService = new MoodboardCardsService();

/**
 * POST /api/moodboard-cards/[id]/archive
 * 归档快捷入口
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const result = await moodboardCardsService.archive(id);
    if (!result) {
      return Response.json({ error: 'Moodboard card not found' }, { status: 404 });
    }
    return result;
  });
}
