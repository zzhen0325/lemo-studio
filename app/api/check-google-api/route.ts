import { getServerServices } from '@/lib/server/container';
import { handleRoute } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  return handleRoute(async () => {
    const { checkGoogleApiService } = await getServerServices();
    return checkGoogleApiService.check();
  });
}
