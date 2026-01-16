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
  public async postImage(@Body() body: ImageRequestBody) {
    // 返回值中可能包含 stream 字段，由上层根据需要封装为 SSE 或其他形式
    return this.aiService.generateImage(body);
  }

  @Post('/text')
  public async postText(@Body() body: TextRequestBody, @Res() res: HTTPResponse) {
    const result = await this.aiService.generateText(body);
    if (result.stream) {
      res.body = result.stream;
      return;
    }
    return result;
  }
}
