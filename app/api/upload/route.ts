import { getServerServices } from '@/lib/server/container';
import { fileValue, handleRoute } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { uploadService } = await getServerServices();
    const formData = await request.formData();
    const file = fileValue(formData.get('file'));
    if (!file) {
      throw new HttpError(400, 'file is required');
    }
    return uploadService.upload({
      name: file.name,
      type: file.type,
      arrayBuffer: () => file.arrayBuffer(),
    });
  });
}
