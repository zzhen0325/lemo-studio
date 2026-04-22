import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import { jsonResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stats — query current page_views and api_calls counts
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('site_stats')
      .select('key, count, updated_at')
      .in('key', ['page_views', 'api_calls']);

    if (error) {
      console.error('[Stats] Failed to query stats:', error);
      return jsonResponse({ pageViews: 0, apiCalls: 0 });
    }

    const rows = data as Array<{ key: string; count: number; updated_at: string }>;
    const map = Object.fromEntries(rows.map((r) => [r.key, r]));
    return jsonResponse({
      pageViews: map.page_views?.count ?? 0,
      apiCalls: map.api_calls?.count ?? 0,
      pageViewsUpdatedAt: map.page_views?.updated_at ?? null,
      apiCallsUpdatedAt: map.api_calls?.updated_at ?? null,
    });
  } catch (error) {
    console.error('[Stats] GET error:', error);
    return jsonResponse({ pageViews: 0, apiCalls: 0 });
  }
}

/**
 * POST /api/stats — record a page view
 * Body: { action: 'page_view' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action !== 'page_view') {
      return jsonResponse({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc('increment_site_stat', {
      p_key: 'page_views',
      p_delta: 1,
    });

    if (error) {
      console.warn('[Stats] page_view increment error:', error.message);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Stats] POST error:', error);
    return jsonResponse({ error: 'Failed to record stats' }, { status: 500 });
  }
}
