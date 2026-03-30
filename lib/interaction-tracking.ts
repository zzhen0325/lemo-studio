/**
 * 交互统计前端工具
 * 用于记录点赞、收藏到情绪板、下载、再次编辑等行为
 */

import type { InteractionAction, InteractionResult } from '@/lib/server/service/interaction.service';
import type { InteractionStats, ViewerState } from '@/types/database';

export interface InteractionTrackingResult {
  success: boolean;
  interactionStats?: InteractionStats;
  viewerState?: ViewerState;
  error?: string;
}

/**
 * 记录交互行为
 */
export async function trackInteraction(
  generationId: string,
  action: InteractionAction,
  userId?: string,
  options?: { moodboardId?: string }
): Promise<InteractionTrackingResult> {
  void userId;
  try {
    const response = await fetch(`/api/history/${generationId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        moodboardId: options?.moodboardId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to track interaction' };
    }

    const result: InteractionResult = await response.json();
    return {
      success: true,
      interactionStats: result.interactionStats,
      viewerState: result.viewerState,
    };
  } catch (error) {
    console.error('Failed to track interaction:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 获取交互数据
 */
export async function getInteractionData(
  generationId: string,
  userId?: string
): Promise<InteractionTrackingResult> {
  void userId;
  try {
    const response = await fetch(`/api/history/${generationId}/interactions`, { method: 'GET' });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to get interaction data' };
    }

    const result: InteractionResult = await response.json();
    return {
      success: true,
      interactionStats: result.interactionStats,
      viewerState: result.viewerState,
    };
  } catch (error) {
    console.error('Failed to get interaction data:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 点赞
 */
export async function likeGeneration(
  generationId: string,
  userId?: string
): Promise<InteractionTrackingResult> {
  return trackInteraction(generationId, 'like', userId);
}

/**
 * 收藏到情绪板
 */
export async function addToMoodboard(
  generationId: string,
  userId: string | undefined,
  moodboardId: string
): Promise<InteractionTrackingResult> {
  return trackInteraction(generationId, 'moodboard_add', userId, { moodboardId });
}

/**
 * 下载
 */
export async function downloadGeneration(
  generationId: string,
  userId?: string
): Promise<InteractionTrackingResult> {
  return trackInteraction(generationId, 'download', userId);
}

/**
 * 编辑
 */
export async function editGeneration(
  generationId: string,
  userId?: string
): Promise<InteractionTrackingResult> {
  return trackInteraction(generationId, 'edit', userId);
}

/**
 * 格式化交互统计显示
 */
export function formatInteractionCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * 格式化时间显示
 */
export function formatLastTime(dateStr?: string): string {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
