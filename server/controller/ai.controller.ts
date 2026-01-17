import { Inject } from '@gulux/gulux';
import { Body, Controller, Post, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { AiService, DescribeRequestBody, ImageRequestBody, TextRequestBody } from '../service/ai.service';

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
    return this.aiService.describe(body);
  }

  @Post('/image')
  public async postImage(@Body() body: ImageRequestBody, @Res() res: HTTPResponse) {
    const result = await this.aiService.generateImage(body);
    if (result.stream) {
      res.headers['Content-Type'] = 'text/event-stream';
      res.headers['Cache-Control'] = 'no-cache';
      res.headers['Connection'] = 'keep-alive';
      res.body = result.stream;
      return;
    }
    return result;
  }

  @Post('/text')
  public async postText(@Body() body: TextRequestBody, @Res() res: HTTPResponse) {
    const result = await this.aiService.generateText(body);
    if (result.stream) {
      res.headers['Content-Type'] = 'text/event-stream';
      res.headers['Cache-Control'] = 'no-cache';
      res.headers['Connection'] = 'keep-alive';
      res.body = result.stream;
      return;
    }
    return result;
  }
}
