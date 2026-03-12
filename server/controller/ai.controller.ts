import { Inject, Logger } from '@gulux/gulux';
import { Body, Controller, Post, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { AiService } from '../service/ai.service';
import type { DescribeRequestBody, ImageRequestBody, TextRequestBody } from '../service/ai.service';
import { Readable } from 'node:stream';
import { HttpError } from '../utils/http-error';
import { DescribeRequestSchema, ImageRequestSchema, TextRequestSchema } from '../../lib/schemas/ai';
import { SaveImageService } from '../service/save-image.service';

/**
 * AI 相关接口（GuluX）
 *
 * - POST /api/ai/describe
 * - POST /api/ai/image
 * - POST /api/ai/text
 */
@Controller('/ai')
export default class AiController {
  @Inject()
  private readonly aiService!: AiService;

  @Inject()
  private readonly logger!: Logger;

  @Inject()
  private readonly saveImageService!: SaveImageService;

  @Post('/describe')
  public async postDescribe(@Body() body: DescribeRequestBody) {
    this.logger.info('ai_describe_request_received', {
      model: body?.model || null,
      hasImage: Boolean(body?.image),
      imageLength: body?.image?.length ?? 0,
      profileId: body?.profileId || null,
      context: body?.context || 'service:describe',
    });
    const parsed = DescribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn('ai_describe_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }
    const result = await this.aiService.describe(parsed.data);
    this.logger.info('ai_describe_request_succeeded', {
      model: parsed.data.model,
      textLength: result.text?.length ?? 0,
    });
    return result;
  }

  @Post('/image')
  public async postImage(@Body() body: ImageRequestBody, @Res() res: HTTPResponse) {
    this.logger.info('ai_image_request_received', {
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
      this.logger.warn('ai_image_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }
    this.logger.info('ai_image_service_call_start', {
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
      result = (await this.aiService.generateImage(parsed.data)) as { stream?: unknown; images?: string[]; metadata?: unknown };
    } catch (error) {
      const err = error as unknown;
      this.logger.error('ai_image_service_call_failed', {
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

    this.logger.info('ai_image_service_call_succeeded', {
      model: parsed.data.model,
      hasStream: Boolean(result.stream),
      imageCount: result.images?.length ?? 0,
      hasMetadata: result.metadata !== undefined,
    });

    if (result.stream) {
      res.set('Content-Type', 'text/event-stream');
      res.set('Cache-Control', 'no-cache, no-transform');
      res.set('Connection', 'keep-alive');
      res.set('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try {
        res.body = (Readable as any).fromWeb(result.stream);
      } catch (error) {
        const err = error as unknown;
        this.logger.error('ai_image_stream_attach_failed', {
          model: parsed.data.model,
          error: err instanceof Error ? err.message : String(err),
        });
        throw error;
      }
      // 强制再次设置 Content-Type，确保框架不会因为 body 赋值而重写它
      res.set('Content-Type', 'text/event-stream');
      this.logger.info('ai_image_stream_response_ready', {
        model: parsed.data.model,
        stream: result.stream,
      });
      return;
    }

    // 大图 CDN 卸载：把 base64 超过 512KB 的图片自动上传 CDN，只返回 URL。
    // 背景：Gemini 2K 图片约 7MB base64，4K 超 10MB，通过 Next.js rewrite 代理传输会
    // 导致内存溢出 / 缓冲超时，引发 ECONNRESET。
    const BASE64_OFFLOAD_THRESHOLD = 512 * 1024; // 512KB
    if (result.images && result.images.length > 0) {
      this.logger.info('ai_image_response_has_images', {
        model: parsed.data.model,
        imageCount: result.images.length,
        base64OffloadThreshold: BASE64_OFFLOAD_THRESHOLD,
      });
      const offloadedImages = await Promise.all(
        result.images.map(async (img, index) => {
          if (img.startsWith('data:') && img.length > BASE64_OFFLOAD_THRESHOLD) {
            this.logger.info('ai_image_offload_start', {
              model: parsed.data.model,
              index,
              encodedLength: img.length,
              encodedKb: Number((img.length / 1024).toFixed(0)),
            });
            try {
              const saved = await this.saveImageService.save({ imageBase64: img, subdir: 'outputs' });
              this.logger.info('ai_image_offload_succeeded', {
                model: parsed.data.model,
                index,
                encodedLength: img.length,
                encodedKb: Number((img.length / 1024).toFixed(0)),
                savedPath: saved.path,
              });
              return saved.path;
            } catch (err) {
              // 上传失败时回退到原始 base64（前端降级处理），不阻断生成结果
              this.logger.error('ai_image_offload_failed', {
                model: parsed.data.model,
                index,
                encodedLength: img.length,
                error: err instanceof Error ? err.message : String(err),
              });
              return img;
            }
          }
          return img;
        })
      );
      this.logger.info('ai_image_response_ready', {
        model: parsed.data.model,
        imageCount: offloadedImages.length,
      });
      return { ...result, images: offloadedImages };
    }

    this.logger.warn('ai_image_response_without_images', {
      model: parsed.data.model,
      hasStream: Boolean(result.stream),
      hasMetadata: result.metadata !== undefined,
    });
    return result;
  }

  @Post('/text')
  public async postText(@Body() body: TextRequestBody, @Res() res: HTTPResponse) {
    this.logger.info('ai_text_request_received', {
      model: body?.model || null,
      inputLength: body?.input?.length ?? 0,
      profileId: body?.profileId || null,
      streamRequested: body?.options?.stream === true,
    });
    const parsed = TextRequestSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn('ai_text_request_invalid', {
        model: body?.model || null,
        issues: parsed.error.flatten(),
      });
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }
    const result = await this.aiService.generateText(parsed.data);
    if (result.stream) {
      res.set('Content-Type', 'text/event-stream');
      res.set('Cache-Control', 'no-cache, no-transform');
      res.set('Connection', 'keep-alive');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.body = (Readable as any).fromWeb(result.stream);
      res.set('Content-Type', 'text/event-stream');
      this.logger.info('ai_text_stream_response_ready', {
        model: parsed.data.model,
        stream: result.stream,
      });
      return;
    }
    this.logger.info('ai_text_request_succeeded', {
      model: parsed.data.model,
      textLength: result.text?.length ?? 0,
    });
    return result;
  }
}
