import { Inject } from '@gulux/gulux';
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
  private readonly saveImageService!: SaveImageService;

  @Post('/describe')
  public async postDescribe(@Body() body: DescribeRequestBody) {
    const parsed = DescribeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }
    return this.aiService.describe(parsed.data);
  }

  @Post('/image')
  public async postImage(@Body() body: ImageRequestBody, @Res() res: HTTPResponse) {
    const parsed = ImageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid request payload', parsed.error.flatten());
    }
    const result = (await this.aiService.generateImage(parsed.data)) as { stream?: unknown; images?: string[] };

    if (result.stream) {
      res.set('Content-Type', 'text/event-stream');
      res.set('Cache-Control', 'no-cache, no-transform');
      res.set('Connection', 'keep-alive');
      res.set('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.body = (Readable as any).fromWeb(result.stream);
      // 强制再次设置 Content-Type，确保框架不会因为 body 赋值而重写它
      res.set('Content-Type', 'text/event-stream');
      return;
    }

    // 大图 CDN 卸载：把 base64 超过 512KB 的图片自动上传 CDN，只返回 URL。
    // 背景：Gemini 2K 图片约 7MB base64，4K 超 10MB，通过 Next.js rewrite 代理传输会
    // 导致内存溢出 / 缓冲超时，引发 ECONNRESET。
    const BASE64_OFFLOAD_THRESHOLD = 512 * 1024; // 512KB
    if (result.images && result.images.length > 0) {
      const offloadedImages = await Promise.all(
        result.images.map(async (img) => {
          if (img.startsWith('data:') && img.length > BASE64_OFFLOAD_THRESHOLD) {
            try {
              const saved = await this.saveImageService.save({ imageBase64: img, subdir: 'outputs' });
              console.info(`[AiController] Offloaded large base64 (${(img.length / 1024).toFixed(0)}KB) → ${saved.path}`);
              return saved.path;
            } catch (err) {
              // 上传失败时回退到原始 base64（前端降级处理），不阻断生成结果
              console.error('[AiController] CDN offload failed, returning raw base64:', err);
              return img;
            }
          }
          return img;
        })
      );
      return { ...result, images: offloadedImages };
    }

    return result;
  }

  @Post('/text')
  public async postText(@Body() body: TextRequestBody, @Res() res: HTTPResponse) {
    const parsed = TextRequestSchema.safeParse(body);
    if (!parsed.success) {
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
      return;
    }
    return result;
  }
}
