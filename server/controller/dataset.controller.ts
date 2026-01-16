import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Files, Get, Post, Put, Query } from '@gulux/gulux/application-http';
import { DatasetService, DatasetQuery, DatasetPostParams, DatasetDeleteParams, DatasetUpdateBody } from '../service/dataset.service';
import { toFileLike } from '../utils/formdata';

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
    return this.service.getDataset(query);
  }

  @Post()
  public async postDataset(
    @Body() body: any,
    @Files() files: Record<string, any>,
  ) {
    const fileLike = toFileLike(files?.file);
    const params: DatasetPostParams = {
      file: fileLike
        ? {
            name: fileLike.name,
            arrayBuffer: fileLike.arrayBuffer,
          }
        : null,
      collection: body?.collection,
      mode: body?.mode,
      newName: body?.newName,
    };
    return this.service.postDataset(params);
  }

  @Delete()
  public async deleteDataset(@Query() params: DatasetDeleteParams) {
    return this.service.deleteDataset(params);
  }

  @Put()
  public async putDataset(@Body() body: DatasetUpdateBody) {
    return this.service.updateDataset(body);
  }
}
