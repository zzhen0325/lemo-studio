import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { PlaygroundShortcutsService } from '@/lib/server/service/playground-shortcuts.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const shortcutsService = new PlaygroundShortcutsService();

/**
 * GET /api/playground-shortcuts/[id]
 * 根据 ID 获取快捷入口
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const shortcut = await shortcutsService.getById(id);
    if (!shortcut) {
      return Response.json({ error: 'Shortcut not found' }, { status: 404 });
    }
    return shortcut;
  });
}

/**
 * PATCH /api/playground-shortcuts/[id]
 * 更新快捷入口
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const body = await request.json();
    const updated = await shortcutsService.update(id, body);
    if (!updated) {
      return Response.json({ error: 'Shortcut not found' }, { status: 404 });
    }
    return updated;
  });
}

/**
 * DELETE /api/playground-shortcuts/[id]
 * 删除快捷入口
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    await shortcutsService.delete(id);
    return { success: true };
  });
}
