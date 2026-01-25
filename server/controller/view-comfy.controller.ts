import { Inject } from '@gulux/gulux';
import { Body, Controller, Get, Post } from '@gulux/gulux/application-http';
import { ViewComfyConfigService } from '../service/view-comfy.service';
import type { ViewComfyConfigPayload } from '../service/view-comfy.service';

/**
 * ViewComfy 工作流配置：
 * - GET  /api/view-comfy
 * - POST /api/view-comfy
 */
@Controller('/view-comfy')
export default class ViewComfyController {
  @Inject()
  private readonly service!: ViewComfyConfigService;

  @Get()
  public async getConfig() {
    return this.service.getConfig();
  }

  @Post()
  public async postConfig(@Body() body: ViewComfyConfigPayload) {
    return this.service.saveConfig(body);
  }
}
