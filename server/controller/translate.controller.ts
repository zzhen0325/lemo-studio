import { Inject } from '@gulux/gulux';
import { Body, Controller, Post } from '@gulux/gulux/application-http';
import { TranslateService } from '../service/translate.service';
import type { TranslateRequestBody } from '../service/translate.service';

/**
 * 文本翻译：
 * - POST /api/translate
 */
@Controller('/translate')
export default class TranslateController {
  @Inject()
  private readonly service!: TranslateService;

  @Post()
  public async postTranslate(@Body() body: TranslateRequestBody) {
    return this.service.translate(body);
  }
}
