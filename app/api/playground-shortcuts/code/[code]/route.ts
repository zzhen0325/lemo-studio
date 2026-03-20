import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { PlaygroundShortcutsService } from '@/lib/server/service/playground-shortcuts.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const shortcutsService = new PlaygroundShortcutsService();

/**
 * GET /api/playground-shortcuts/code/[code]
 * 根据 code 获取快捷入口
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  return handleRoute(async () => {
    const { code } = await params;
    const shortcut = await shortcutsService.getByCode(code);
    if (!shortcut) {
      return Response.json({ error: 'Shortcut not found' }, { status: 404 });
    }
    return shortcut;
  });
}
