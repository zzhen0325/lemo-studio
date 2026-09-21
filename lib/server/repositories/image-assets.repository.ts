import { ImageAssetModel, type ImageAssetDoc } from '../db/models';

export type ImageAssetRecord = ImageAssetDoc;

export class ImageAssetsRepository {
  public async findById(id: string): Promise<ImageAssetRecord | null> {
    return ImageAssetModel.findById(id);
  }

  public async create(doc: Partial<ImageAssetRecord>): Promise<ImageAssetRecord> {
    return ImageAssetModel.create(doc);
  }

  public async upsert(
    filter: Record<string, unknown>,
    update: Partial<ImageAssetRecord>,
    options?: { upsert?: boolean },
  ): Promise<void> {
    const { fileName, ...storedUpdate } = update;
    await ImageAssetModel.updateOne(filter, {
      ...storedUpdate,
      ...(fileName !== undefined ? { file_name: fileName } : {}),
    }, options);
  }

  public async deleteMany(filter: Record<string, unknown>): Promise<void> {
    await ImageAssetModel.deleteMany(filter);
  }
}
