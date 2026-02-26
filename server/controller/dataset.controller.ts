import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Files, Get, Post, Put, Query } from '@gulux/gulux/application-http';
import { DatasetService } from '../service/dataset.service';
import type { DatasetQuery, DatasetPostParams, DatasetDeleteParams, DatasetUpdateBody } from '../service/dataset.service';
import { toFileLike, toFileLikeList } from '../utils/formdata';
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
    const fileList = toFileLikeList(files?.files as KoaBodyFile | KoaBodyFile[] | undefined);
    const promptMapRaw = body?.promptMap;
    let promptMap: Record<string, string> | undefined;
    if (typeof promptMapRaw === 'string' && promptMapRaw.trim().length > 0) {
      try {
        const parsedPromptMap = JSON.parse(promptMapRaw) as Record<string, unknown>;
        promptMap = Object.entries(parsedPromptMap).reduce<Record<string, string>>((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          }
          return acc;
        }, {});
      } catch {
        throw new HttpError(400, 'Invalid promptMap');
      }
    } else if (promptMapRaw && typeof promptMapRaw === 'object') {
      promptMap = Object.entries(promptMapRaw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    const params: DatasetPostParams = {
      file: fileLike
        ? {
          name: fileLike.name,
          arrayBuffer: fileLike.arrayBuffer,
        }
        : null,
      files: fileList.map((item) => ({
        name: item.name,
        arrayBuffer: item.arrayBuffer,
      })),
      collection: parsed.data.collection,
      mode: parsed.data.mode,
      newName: parsed.data.newName ?? undefined,
      promptMap,
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
