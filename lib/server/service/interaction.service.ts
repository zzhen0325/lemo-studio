/**
 * 交互统计服务
 * 处理点赞、收藏到情绪板、下载、再次编辑等行为的统计
 */

import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import type { InteractionStats, ViewerState } from '@/types/database';

export type InteractionAction = 'like' | 'moodboard_add' | 'download' | 'edit';

export interface InteractionResult {
  interactionStats: InteractionStats;
  viewerState: ViewerState;
}

export interface InteractionServiceOptions {
  generationId: string;
  action: InteractionAction;
  userId: string;
  moodboardId?: string; // 用于 moodboard_add 去重
}

/**
 * 记录交互行为并返回最新统计
 */
export async function recordInteraction(options: InteractionServiceOptions): Promise<InteractionResult> {
  const { generationId, action, userId, moodboardId } = options;
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  switch (action) {
    case 'like':
      return await handleLike(supabase, generationId, userId, now);
    case 'moodboard_add':
      return await handleMoodboardAdd(supabase, generationId, userId, moodboardId, now);
    case 'download':
      return await handleDownload(supabase, generationId, userId, now);
    case 'edit':
      return await handleEdit(supabase, generationId, userId, now);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 获取交互统计和用户状态
 */
export async function getInteractionData(generationId: string, userId?: string): Promise<{
  interactionStats: InteractionStats;
  viewerState: ViewerState;
}> {
  const supabase = getSupabaseClient();

  // 获取 generation 的交互统计
  const { data: generation, error } = await supabase
    .from('generations')
    .select('like_count, moodboard_add_count, download_count, edit_count, last_liked_at, last_moodboard_added_at, last_downloaded_at, last_edited_at')
    .eq('id', generationId)
    .single();

  if (error) {
    console.error('Failed to get interaction stats:', error);
    return {
      interactionStats: getDefaultStats(),
      viewerState: { hasLiked: false }
    };
  }

  const interactionStats: InteractionStats = {
    likeCount: generation?.like_count || 0,
    moodboardAddCount: generation?.moodboard_add_count || 0,
    downloadCount: generation?.download_count || 0,
    editCount: generation?.edit_count || 0,
    lastLikedAt: generation?.last_liked_at || undefined,
    lastMoodboardAddedAt: generation?.last_moodboard_added_at || undefined,
    lastDownloadedAt: generation?.last_downloaded_at || undefined,
    lastEditedAt: generation?.last_edited_at || undefined,
  };

  // 检查用户是否已点赞
  let hasLiked = false;
  if (userId) {
    const { data: likeRecord } = await supabase
      .from('generation_likes')
      .select('id')
      .eq('generation_id', generationId)
      .eq('user_id', userId)
      .maybeSingle();
    hasLiked = !!likeRecord;
  }

  return {
    interactionStats,
    viewerState: { hasLiked }
  };
}

/**
 * 批量获取多张图片的交互数据
 */
export async function getBatchInteractionData(
  generationIds: string[], 
  userId?: string
): Promise<Map<string, { interactionStats: InteractionStats; viewerState: ViewerState }>> {
  const result = new Map();
  const supabase = getSupabaseClient();

  if (generationIds.length === 0) return result;

  // 批量获取交互统计
  const { data: generations, error } = await supabase
    .from('generations')
    .select('id, like_count, moodboard_add_count, download_count, edit_count, last_liked_at, last_moodboard_added_at, last_downloaded_at, last_edited_at')
    .in('id', generationIds);

  if (error) {
    console.error('Failed to get batch interaction stats:', error);
    generationIds.forEach(id => {
      result.set(id, { interactionStats: getDefaultStats(), viewerState: { hasLiked: false } });
    });
    return result;
  }

  // 批量获取用户点赞状态
  let likedGenerationIds = new Set<string>();
  if (userId) {
    const { data: likeRecords } = await supabase
      .from('generation_likes')
      .select('generation_id')
      .eq('user_id', userId)
      .in('generation_id', generationIds);
    
    if (likeRecords) {
      likedGenerationIds = new Set(likeRecords.map(r => r.generation_id));
    }
  }

  // 组装结果
  const generationMap = new Map(generations?.map(g => [g.id, g]));
  for (const id of generationIds) {
    const gen = generationMap.get(id);
    result.set(id, {
      interactionStats: {
        likeCount: gen?.like_count || 0,
        moodboardAddCount: gen?.moodboard_add_count || 0,
        downloadCount: gen?.download_count || 0,
        editCount: gen?.edit_count || 0,
        lastLikedAt: gen?.last_liked_at || undefined,
        lastMoodboardAddedAt: gen?.last_moodboard_added_at || undefined,
        lastDownloadedAt: gen?.last_downloaded_at || undefined,
        lastEditedAt: gen?.last_edited_at || undefined,
      },
      viewerState: { hasLiked: likedGenerationIds.has(id) }
    });
  }

  return result;
}

// ==========================================
// 私有函数
// ==========================================

async function handleLike(
  supabase: ReturnType<typeof getSupabaseClient>,
  generationId: string,
  userId: string,
  now: string
): Promise<InteractionResult> {
  // 检查是否已点赞
  const { data: existingLike } = await supabase
    .from('generation_likes')
    .select('id')
    .eq('generation_id', generationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingLike) {
    // 已点赞，幂等返回
    return getInteractionData(generationId, userId);
  }

  // 创建点赞记录并递增计数
  const { error: likeError } = await supabase
    .from('generation_likes')
    .insert({ generation_id: generationId, user_id: userId, created_at: now });

  if (likeError) {
    console.error('Failed to create like record:', likeError);
    // 可能是并发创建了，尝试获取现有数据
    return getInteractionData(generationId, userId);
  }

  // 递增 like_count
  const { error: updateError } = await supabase.rpc('increment_like_count', {
    p_generation_id: generationId,
    p_now: now
  });

  if (updateError) {
    // 如果 RPC 不存在，使用普通更新
    const { data: current } = await supabase
      .from('generations')
      .select('like_count')
      .eq('id', generationId)
      .single();
    
    await supabase
      .from('generations')
      .update({ 
        like_count: (current?.like_count || 0) + 1,
        last_liked_at: now 
      })
      .eq('id', generationId);
  }

  return getInteractionData(generationId, userId);
}

async function handleMoodboardAdd(
  supabase: ReturnType<typeof getSupabaseClient>,
  generationId: string,
  _userId: string,
  moodboardId?: string,
  now?: string
): Promise<InteractionResult> {
  if (!moodboardId) {
    // 如果没有 moodboardId，只递增计数（兼容旧行为）
    await incrementCount(supabase, generationId, 'moodboard_add', now);
    return getInteractionData(generationId);
  }

  // 检查 style_stacks 表中是否已存在该图片
  const { data: existingEntry } = await supabase
    .from('style_stacks')
    .select('id')
    .eq('generation_id', generationId)
    .eq('moodboard_id', moodboardId)
    .maybeSingle();

  if (existingEntry) {
    // 已存在于该情绪板，幂等返回
    return getInteractionData(generationId);
  }

  // 递增计数
  await incrementCount(supabase, generationId, 'moodboard_add', now);
  return getInteractionData(generationId);
}

async function handleDownload(
  supabase: ReturnType<typeof getSupabaseClient>,
  generationId: string,
  _userId: string,
  now: string
): Promise<InteractionResult> {
  await incrementCount(supabase, generationId, 'download', now);
  return getInteractionData(generationId);
}

async function handleEdit(
  supabase: ReturnType<typeof getSupabaseClient>,
  generationId: string,
  _userId: string,
  now: string
): Promise<InteractionResult> {
  await incrementCount(supabase, generationId, 'edit', now);
  return getInteractionData(generationId);
}

async function incrementCount(
  supabase: ReturnType<typeof getSupabaseClient>,
  generationId: string,
  type: 'moodboard_add' | 'download' | 'edit',
  now?: string
): Promise<void> {
  const timestamp = now || new Date().toISOString();
  
  const countField = `${type}_count`;
  const timestampField = `last_${type === 'moodboard_add' ? 'moodboard_added' : type}_at`;

  // 获取当前值
  const { data: current } = await supabase
    .from('generations')
    .select(countField)
    .eq('id', generationId)
    .single();

  const currentRecord = current as Record<string, unknown> | null;
  const currentCount = (currentRecord?.[countField] as number) || 0;

  // 更新
  await supabase
    .from('generations')
    .update({ 
      [countField]: currentCount + 1,
      [timestampField]: timestamp 
    })
    .eq('id', generationId);
}

function getDefaultStats(): InteractionStats {
  return {
    likeCount: 0,
    moodboardAddCount: 0,
    downloadCount: 0,
    editCount: 0,
  };
}
