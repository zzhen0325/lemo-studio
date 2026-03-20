import { NextRequest } from 'next/server';
import { handleRoute, queryValue } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import { PlaygroundShortcutsService } from '@/lib/server/service/playground-shortcuts.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 实例化服务
const shortcutsService = new PlaygroundShortcutsService();

/**
 * GET /api/playground-shortcuts
 * 获取快捷入口列表
 * Query params:
 * - enabled: boolean - 是否只返回启用的（首页用）
 * - status: 'draft' | 'published' | 'archived' - 按状态筛选
 */
export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const enabled = queryValue(request, 'enabled');
    const status = queryValue(request, 'status') as 'draft' | 'published' | 'archived' | null;

    if (enabled === 'true') {
      // 首页用：只返回启用且已发布的
      return shortcutsService.listEnabled();
    }

    // 管理后台用：返回所有，支持状态筛选
    return shortcutsService.listAll({ status: status ?? undefined });
  });
}

/**
 * POST /api/playground-shortcuts
 * 创建快捷入口
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json();
    return shortcutsService.create(body);
  });
}
