import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const moodboardCardsService = new MoodboardCardsService();

/**
 * GET /api/moodboard-cards/[id]
 * 根据 ID 获取快捷入口
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const shortcut = await moodboardCardsService.getById(id);
    if (!shortcut) {
      return Response.json({ error: 'Moodboard card not found' }, { status: 404 });
    }
    return shortcut;
  });
}

/**
 * PATCH /api/moodboard-cards/[id]
 * 更新快捷入口
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = await request.json();
    const updated = await moodboardCardsService.update(id, body);
    if (!updated) {
      return Response.json({ error: 'Moodboard card not found' }, { status: 404 });
    }
    return updated;
  });
}

/**
 * DELETE /api/moodboard-cards/[id]
 * 删除快捷入口
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    await moodboardCardsService.delete(id);
    return { success: true };
  });
}
