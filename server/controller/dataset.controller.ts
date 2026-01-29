import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Files, Get, Post, Put, Query } from '@gulux/gulux/application-http';
import { DatasetService } from '../service/dataset.service';
import type { DatasetQuery, DatasetPostParams, DatasetDeleteParams, DatasetUpdateBody } from '../service/dataset.service';
import { toFileLike } from '../utils/formdata';
import type { KoaBodyFile } from '../utils/formdata';
import { HttpError } from '../utils/http-error';
import { DatasetDeleteSchema, DatasetPostSchema, DatasetQuerySchema, DatasetUpdateSchema } from '../../lib/schemas/dataset';

/**
 * 数据集管理：
 * - GET    /api/dataset
 * - POST   /api/dataset
 * - DELETE /api/dataset
 * - PUT    /api/dataset
 */
@Controller('/dataset')
export default class DatasetController {
  @Inject()
  private readonly service!: DatasetService;

  @Get()
  public async getDataset(@Query() query: DatasetQuery) {
    const parsed = DatasetQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    return this.service.getDataset(parsed.data);
  }

  @Post()
  public async postDataset(
    @Body() body: Record<string, unknown>,
    @Files() files: Record<string, unknown>,
  ) {
    const parsed = DatasetPostSchema.safeParse({
      collection: body?.collection,
      mode: body?.mode,
      newName: body?.newName,
    });
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const fileLike = toFileLike(files?.file as KoaBodyFile | KoaBodyFile[] | undefined);
    const params: DatasetPostParams = {
      file: fileLike
        ? {
          name: fileLike.name,
          arrayBuffer: fileLike.arrayBuffer,
        }
        : null,
      collection: parsed.data.collection,
      mode: parsed.data.mode,
      newName: parsed.data.newName ?? undefined,
    };
    return this.service.postDataset(params);
  }

  @Delete()
  public async deleteDataset(@Query() params: DatasetDeleteParams) {
    const parsed = DatasetDeleteSchema.safeParse(params);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    return this.service.deleteDataset(parsed.data);
  }

  @Put()
  public async putDataset(@Body() body: DatasetUpdateBody) {
    const parsed = DatasetUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }
    return this.service.updateDataset(parsed.data);
  }
}
