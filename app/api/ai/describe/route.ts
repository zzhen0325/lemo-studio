import { DescribeRequestSchema } from '@/lib/schemas/ai';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { DescribeRequestBody } from '@/lib/server/service/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { aiService, logger } = await getServerServices();
    const body = await readJsonBody<DescribeRequestBody>(request);

    logger.info('ai_describe_request_received', {
      model: body?.model || null,
      hasImage: Boolean(body?.image),
      imageLength: body?.image?.length ?? 0,
      profileId: body?.profileId || null,
      context: body?.context || 'service:describe',
    });

    const parsed = DescribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn('ai_describe_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }

    const result = await aiService.describe(parsed.data);
    logger.info('ai_describe_request_succeeded', {
      model: parsed.data.model,
      textLength: result.text?.length ?? 0,
    });
    return result;
  });
}
