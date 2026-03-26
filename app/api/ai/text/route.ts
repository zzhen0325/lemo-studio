import { TextRequestSchema } from '@/lib/schemas/ai';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody, streamResponse } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { TextRequestBody } from '@/lib/server/service/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { aiService, logger } = await getServerServices();
    const body = await readJsonBody<TextRequestBody>(request);

    logger.info('ai_text_request_received', {
      model: body?.model || null,
      inputLength: body?.input?.length ?? 0,
      profileId: body?.profileId || null,
      streamRequested: body?.options?.stream === true,
    });

    const parsed = TextRequestSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn('ai_text_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }

    const result = await aiService.generateText(parsed.data);
    if (result.stream) {
      logger.info('ai_text_stream_response_ready', {
        model: parsed.data.model,
        stream: result.stream,
      });
      return streamResponse(result.stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    logger.info('ai_text_request_succeeded', {
      model: parsed.data.model,
      profileId: parsed.data.profileId || null,
      textLength: result.text?.length ?? 0,
    });
    logger.info('ai_text_response_body', {
      model: parsed.data.model,
      profileId: parsed.data.profileId || null,
      text: result.text ?? null,
    });
    return result;
  });
}
