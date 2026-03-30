/**
 * 管理员接口：修复过期预签名 URL
 * 
 * 使用方式：
 * GET /api/admin/fix-urls - 查看当前统计
 * POST /api/admin/fix-urls - 执行修复
 * 
 * 注意：此接口仅供管理员使用，建议在生产环境中执行后删除
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/src/storage/database/supabase-client';

export async function POST() {
  try {
    const supabase = getSupabaseClient();
    
    // 修复前统计
    const beforeStats = await getStats(supabase);
    
    // 1. 修复 generations 表 - 缺少前缀的 storage key
    // 使用 Supabase 的 update + filter 方式
    await supabase
      .from('generations')
      .update({ 
        output_url: 'ljhwZthlaukjlkulzlp/' 
      })
      .not('output_url', 'like', 'ljhwZthlaukjlkulzlp/%')
      .not('output_url', 'like', 'http%')
      .not('output_url', 'is', null)
      .neq('output_url', '');
    
    // 对于过期预签名 URL，需要使用 RPC 或原始 SQL
    // 由于 Supabase 客户端不支持 substring 操作，我们使用 fetch 直接调用数据库 API
    
    // 2. 修复 dataset_entries 表 - 缺少前缀
    await supabase
      .from('dataset_entries')
      .update({ url: 'ljhwZthlaukjlkulzlp/' })
      .not('url', 'like', 'ljhwZthlaukjlkulzlp/%')
      .not('url', 'like', 'http%')
      .not('url', 'is', null)
      .neq('url', '');
    
    // 修复后统计
    const afterStats = await getStats(supabase);
    
    const fixed = {
      generations: (beforeStats.generations.total - afterStats.generations.invalid) || 0,
      dataset_entries: (beforeStats.dataset_entries.total - afterStats.dataset_entries.invalid) || 0,
      image_assets: (beforeStats.image_assets.total - afterStats.image_assets.invalid) || 0,
    };
    
    return NextResponse.json({
      success: true,
      before: beforeStats,
      after: afterStats,
      fixed,
      message: '部分修复完成。对于过期预签名 URL，请使用 SQL 脚本手动修复。',
      sqlScriptPath: 'scripts/fix-expired-urls.sql'
    });
  } catch (error) {
    console.error('修复过期 URL 失败:', error);
    return NextResponse.json(
      { error: '修复失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function getStats(supabase: ReturnType<typeof getSupabaseClient>) {
  // generations 统计
  const { count: genTotal } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .not('output_url', 'is', null)
    .neq('output_url', '');
  
  const { count: genValid } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .like('output_url', 'ljhwZthlaukjlkulzlp/%');
  
  // dataset_entries 统计
  const { count: datasetTotal } = await supabase
    .from('dataset_entries')
    .select('*', { count: 'exact', head: true })
    .not('url', 'is', null)
    .neq('url', '');
  
  const { count: datasetValid } = await supabase
    .from('dataset_entries')
    .select('*', { count: 'exact', head: true })
    .like('url', 'ljhwZthlaukjlkulzlp/%');
  
  // image_assets 统计
  const { count: assetsTotal } = await supabase
    .from('image_assets')
    .select('*', { count: 'exact', head: true })
    .not('url', 'is', null)
    .neq('url', '');
  
  const { count: assetsValid } = await supabase
    .from('image_assets')
    .select('*', { count: 'exact', head: true })
    .like('url', 'ljhwZthlaukjlkulzlp/%');
  
  return {
    generations: { 
      total: genTotal || 0, 
      valid: genValid || 0, 
      invalid: (genTotal || 0) - (genValid || 0) 
    },
    dataset_entries: { 
      total: datasetTotal || 0, 
      valid: datasetValid || 0,
      invalid: (datasetTotal || 0) - (datasetValid || 0)
    },
    image_assets: { 
      total: assetsTotal || 0, 
      valid: assetsValid || 0,
      invalid: (assetsTotal || 0) - (assetsValid || 0)
    }
  };
}

// GET 方法：只查看统计，不执行修复
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const stats = await getStats(supabase);
    
    return NextResponse.json({
      success: true,
      stats,
      message: '当前数据库 URL 状态统计',
      hint: '对于过期预签名 URL，请使用 scripts/fix-expired-urls.sql 脚本在 Supabase 控制台执行'
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    return NextResponse.json(
      { error: '获取统计失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
