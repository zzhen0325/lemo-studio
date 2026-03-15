import { ImageRequestSchema } from '@/lib/schemas/ai';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, readJsonBody, streamResponse } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import type { ImageRequestBody } from '@/lib/server/service/ai.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BASE64_OFFLOAD_THRESHOLD = 512 * 1024;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { aiService, saveImageService, logger } = await getServerServices();
    const body = await readJsonBody<ImageRequestBody>(request);

    logger.info('ai_image_request_received', {
      model: body?.model || null,
      promptLength: body?.prompt?.length ?? 0,
      width: body?.width ?? null,
      height: body?.height ?? null,
      aspectRatio: body?.aspectRatio || null,
      imageSize: body?.imageSize || null,
      batchSize: body?.batchSize ?? null,
      hasImage: Boolean(body?.image),
      imageCount: body?.images?.length ?? (body?.image ? 1 : 0),
      streamRequested: body?.options?.stream === true,
    });

    const parsed = ImageRequestSchema.safeParse(body);
    if (!parsed.success) {
      logger.warn('ai_image_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }

    logger.info('ai_image_service_call_start', {
      model: parsed.data.model,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      aspectRatio: parsed.data.aspectRatio || null,
      imageSize: parsed.data.imageSize || null,
      batchSize: parsed.data.batchSize ?? null,
      hasImage: Boolean(parsed.data.image),
      imageCount: parsed.data.images?.length ?? (parsed.data.image ? 1 : 0),
      streamRequested: parsed.data.options?.stream === true,
    });

    let result: { stream?: unknown; images?: string[]; metadata?: unknown };
    try {
      result = (await aiService.generateImage(parsed.data)) as { stream?: unknown; images?: string[]; metadata?: unknown };
    } catch (error) {
      const err = error as unknown;
      logger.error('ai_image_service_call_failed', {
        model: parsed.data.model,
        width: parsed.data.width ?? null,
        height: parsed.data.height ?? null,
        aspectRatio: parsed.data.aspectRatio || null,
        imageSize: parsed.data.imageSize || null,
        batchSize: parsed.data.batchSize ?? null,
        hasImage: Boolean(parsed.data.image),
        imageCount: parsed.data.images?.length ?? (parsed.data.image ? 1 : 0),
        streamRequested: parsed.data.options?.stream === true,
        error: err instanceof Error ? err.message : String(err),
        details: err instanceof HttpError ? err.details ?? null : null,
      });
      throw error;
    }

    logger.info('ai_image_service_call_succeeded', {
      model: parsed.data.model,
      hasStream: Boolean(result.stream),
      imageCount: result.images?.length ?? 0,
      hasMetadata: result.metadata !== undefined,
    });

    if (result.stream) {
      logger.info('ai_image_stream_response_ready', {
        model: parsed.data.model,
        stream: result.stream,
      });
      return streamResponse(result.stream as ReadableStream<Uint8Array>, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    if (result.images && result.images.length > 0) {
      logger.info('ai_image_response_has_images', {
        model: parsed.data.model,
        imageCount: result.images.length,
        base64OffloadThreshold: BASE64_OFFLOAD_THRESHOLD,
      });

      const offloadedImages = await Promise.all(
        result.images.map(async (img, index) => {
          if (img.startsWith('data:') && img.length > BASE64_OFFLOAD_THRESHOLD) {
            logger.info('ai_image_offload_start', {
              model: parsed.data.model,
              index,
              encodedLength: img.length,
              encodedKb: Number((img.length / 1024).toFixed(0)),
            });
            try {
              const saved = await saveImageService.save({ imageBase64: img, subdir: 'outputs' });
              logger.info('ai_image_offload_succeeded', {
                model: parsed.data.model,
                index,
                encodedLength: img.length,
                encodedKb: Number((img.length / 1024).toFixed(0)),
                savedPath: saved.path,
              });
              return saved.path;
            } catch (error) {
              logger.error('ai_image_offload_failed', {
                model: parsed.data.model,
                index,
                encodedLength: img.length,
                error: error instanceof Error ? error.message : String(error),
              });
              return img;
            }
          }
          return img;
        }),
      );

      logger.info('ai_image_response_ready', {
        model: parsed.data.model,
        imageCount: offloadedImages.length,
      });
      return { ...result, images: offloadedImages };
    }

    logger.warn('ai_image_response_without_images', {
      model: parsed.data.model,
      hasStream: Boolean(result.stream),
      hasMetadata: result.metadata !== undefined,
    });
    return result;
  });
}
