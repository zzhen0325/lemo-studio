import { Inject } from '@gulux/gulux';
import { Body, Controller, Post } from '@gulux/gulux/application-http';
import { SaveImageService } from '../service/save-image.service';
import type { SaveImageRequestBody } from '../service/save-image.service';

/**
 * 保存图片：
 * - POST /api/save-image
 */
@Controller('/save-image')
export default class SaveImageController {
  @Inject()
  private readonly service!: SaveImageService;

  @Post()
  public async postSaveImage(@Body() body: SaveImageRequestBody) {
    return this.service.save(body);
  }
}
