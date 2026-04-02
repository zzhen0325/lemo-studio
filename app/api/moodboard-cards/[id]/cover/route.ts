import { NextRequest } from 'next/server';
import { handleRoute } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import { MoodboardCardsService } from '@/lib/server/service/moodboard-cards.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const moodboardCardsService = new MoodboardCardsService();

/**
 * POST /api/moodboard-cards/[id]/cover
 * 上传封面图
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const { id } = await params;
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new HttpError(400, 'No file provided');
    }

    const result = await moodboardCardsService.uploadCoverImage(id, {
      name: file.name,
      type: file.type,
      arrayBuffer: () => file.arrayBuffer(),
    });

    return result;
  });
}
