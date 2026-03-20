import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { PlaygroundShortcutsService } from '@/lib/server/service/playground-shortcuts.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const shortcutsService = new PlaygroundShortcutsService();

/**
 * POST /api/playground-shortcuts/[id]/archive
 * 归档快捷入口
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    const result = await shortcutsService.archive(id);
    if (!result) {
      return Response.json({ error: 'Shortcut not found' }, { status: 404 });
    }
    return result;
  });
}
