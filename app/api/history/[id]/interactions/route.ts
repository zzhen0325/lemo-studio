/**
 * 交互行为 API
 * POST /api/history/[id]/interactions
 * 
 * 记录用户交互行为（点赞、收藏到情绪板、下载、再次编辑）
 */

import { NextRequest, NextResponse } from 'next/server';
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
    const body = await request.json();
    
    const { action, userId, moodboardId } = body as {
      action: InteractionAction;
      userId: string;
      moodboardId?: string;
    };

    if (!generationId) {
      return NextResponse.json(
        { error: 'Missing generation ID' },
        { status: 400 }
      );
    }

    if (!action || !['like', 'moodboard_add', 'download', 'edit'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: like, moodboard_add, download, edit' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const result = await recordInteraction({
      generationId,
      action,
      userId,
      moodboardId
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Failed to record interaction:', error);
    return NextResponse.json(
      { error: 'Failed to record interaction', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: generationId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;

    if (!generationId) {
      return NextResponse.json(
        { error: 'Missing generation ID' },
        { status: 400 }
      );
    }

    const result = await getInteractionData(generationId, userId);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Failed to get interaction data:', error);
    return NextResponse.json(
      { error: 'Failed to get interaction data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
