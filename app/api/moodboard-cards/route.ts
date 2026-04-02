import { NextRequest } from 'next/server';
import { handleRoute, queryValue } from '@/lib/server/http';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 实例化服务
const moodboardCardsService = new MoodboardCardsService();

/**
 * GET /api/moodboard-cards
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
      return moodboardCardsService.listEnabled();
    }

    // 管理后台用：返回所有，支持状态筛选
    return moodboardCardsService.listAll({ status: status ?? undefined });
  });
}

/**
 * POST /api/moodboard-cards
 * 创建快捷入口
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json();
    return moodboardCardsService.create(body);
  });
}
