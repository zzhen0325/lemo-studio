import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Get, Post, Query } from '@gulux/gulux/application-http';
import { StylesService } from '../service/styles.service';
import type { StyleStack } from '@/types/database';
import { HttpError } from '../utils/http-error';

/**
 * 风格样式栈：
 * - GET    /api/styles
 * - POST   /api/styles
 * - DELETE /api/styles?id=xxx
 */
@Controller('/styles')
export default class StylesController {
  @Inject()
  private readonly service!: StylesService;

  @Get()
  public async getStyles() {
    return this.service.listStyles();
  }

  @Post()
  public async postStyle(@Body() style: StyleStack) {
    return this.service.saveStyle(style);
  }

  @Delete()
  public async deleteStyle(@Query('id') id?: string) {
    if (!id) {
      throw new HttpError(400, 'Missing ID');
    }
    await this.service.deleteStyle(id);
    return { success: true };
  }
}
