import { Inject } from '@gulux/gulux';
import { Controller, Get, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { DatasetSyncService } from '../service/dataset-sync.service';

/**
 * 数据集变更 SSE：
 * - GET /api/dataset/sync
 */
@Controller('/dataset')
export default class DatasetSyncController {
  @Inject()
  private readonly service!: DatasetSyncService;

  @Get('/sync')
  public async getSyncStream(@Res() res: HTTPResponse) {
    const stream = this.service.createSyncStream();
    res.set('Content-Type', 'text/event-stream');
    res.set('Cache-Control', 'no-cache, no-transform');
    res.set('Connection', 'keep-alive');
    res.body = stream;
  }
}
