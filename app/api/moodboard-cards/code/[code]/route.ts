import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const moodboardCardsService = new MoodboardCardsService();

/**
 * GET /api/moodboard-cards/code/[code]
 * 根据 code 获取快捷入口
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return handleRoute(async () => {
    const { code } = await params;
    const shortcut = await moodboardCardsService.getByCode(code);
    if (!shortcut) {
      return Response.json({ error: 'Moodboard card not found' }, { status: 404 });
    }
    return shortcut;
  });
}
