import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Get, Post, Query, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { ApiConfigService } from '../service/api-config.service';
import { HttpError } from '../utils/http-error';

/**
 * API 配置：
 * - GET    /api/api-config
 * - POST   /api/api-config
 * - DELETE /api/api-config?id=xxx
 */
@Controller('/api-config')
export default class ApiConfigController {
  @Inject()
  private readonly service!: ApiConfigService;

  @Get()
  public async getConfig(@Res() res: HTTPResponse) {
    const data = await this.service.getAll();
    if (res) {
      res.set('Content-Type', 'application/json');
      res.body = data;
      return;
    }
    return data;
  }

  @Post()
  public async postConfig(@Body() body: Record<string, unknown>) {
    return this.service.handlePost(body);
  }

  @Delete()
  public async deleteProvider(@Query('id') id?: string) {
    if (!id) {
      throw new HttpError(400, 'Missing provider ID');
    }
    await this.service.deleteProvider(id);
    return { success: true };
  }
}
