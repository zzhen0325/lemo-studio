/**
 * 交互行为 API
 * POST /api/history/[id]/interactions
 * 
 * 记录用户交互行为（点赞、收藏到情绪板、下载、再次编辑）
 */

import { NextRequest } from 'next/server';
import { attachSessionCookie, getOrCreateSession } from '@/lib/server/auth/session';
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/server/http';
import { recordInteraction, getInteractionData, type InteractionAction } from '@/lib/server/service/interaction.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: generationId } = await params;
    const body = await readJsonBody<{ action?: InteractionAction; moodboardId?: string }>(request);
    const resolution = await getOrCreateSession();
    
    const { action, moodboardId } = body;

    if (!generationId) {
      return jsonResponse({ error: 'Missing generation ID' }, { status: 400 });
    }

    if (!action || !['like', 'moodboard_add', 'download', 'edit'].includes(action)) {
      return jsonResponse({ error: 'Invalid action. Must be one of: like, moodboard_add, download, edit' }, { status: 400 });
    }

    const result = await recordInteraction({
      generationId,
      action,
      userId: resolution.session.actorId,
      moodboardId
    });

    const response = jsonResponse({
      success: true,
      ...result
    });
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    console.error('Failed to record interaction:', error);
    return errorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: generationId } = await params;
    const resolution = await getOrCreateSession();

    if (!generationId) {
      return jsonResponse({ error: 'Missing generation ID' }, { status: 400 });
    }

    const result = await getInteractionData(generationId, resolution.session.actorId);

    const response = jsonResponse({
      success: true,
      ...result
    });
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    console.error('Failed to get interaction data:', error);
    return errorResponse(error);
  }
}
