import { Inject } from '@gulux/gulux';
import { Controller, Get, Res } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { DatasetSyncService } from '../service/dataset-sync.service';
import { Readable } from 'node:stream';

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
    res.set('X-Accel-Buffering', 'no');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.body = (Readable as any).fromWeb(stream);
    // 再次设置，避免框架在 body 赋值后重置 Content-Type
    res.set('Content-Type', 'text/event-stream');
  }
}
