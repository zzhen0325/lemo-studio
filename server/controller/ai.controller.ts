import { Inject } from '@gulux/gulux';
import { Body, Controller, Post, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { AiService } from '../service/ai.service';
import type { DescribeRequestBody, ImageRequestBody, TextRequestBody } from '../service/ai.service';
import { Readable } from 'node:stream';
import { HttpError } from '../utils/http-error';
import { DescribeRequestSchema, ImageRequestSchema, TextRequestSchema } from '../../lib/schemas/ai';

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
    const result = (await this.aiService.generateImage(parsed.data)) as { stream?: unknown };

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
