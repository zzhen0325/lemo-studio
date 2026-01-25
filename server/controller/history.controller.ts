import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Get, Post, Query } from '@gulux/gulux/application-http';
import { HistoryService } from '../service/history.service';
import type { HistoryQuery } from '../service/history.service';

/**
 * 历史记录：
 * - GET  /api/history
 * - POST /api/history
 */
@Controller('/history')
export default class HistoryController {
  @Inject()
  private readonly service!: HistoryService;

  @Get()
  public async getHistory(@Query() query: HistoryQuery) {
    return this.service.getHistory(query);
  }

  @Post()
  public async postHistory(@Body() body: any) {
    return this.service.saveHistory(body);
  }

  @Delete()
  public async deleteHistory(@Body() body: { ids: string[] }) {
    return this.service.deleteHistory(body.ids);
  }
}
