import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { datasetEvents, DATASET_SYNC_EVENT } from '../../lib/server/dataset-events';
import { HttpError } from '../utils/http-error';
import { uploadBufferToCdn } from '../utils/cdn';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';
import {
  DatasetCollection,
  DatasetEntry,
  ImageAsset,
} from '../db';

export interface DatasetQuery {
  collection?: string | null;
}

// 与 Web File 兼容的最小类型
export interface DatasetFileLike {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface DatasetPostParams {
  file?: DatasetFileLike | null;
  files?: DatasetFileLike[];
  collection: string;
  mode?: string | null;
  newName?: string | null;
  promptMap?: Record<string, string>;
}

export interface DatasetDeleteParams {
  collection: string;
  filename?: string | null;
  filenames?: string | null;
}

export interface DatasetUpdateBody {
  collection: string;
  filename?: string;
  prompt?: string;
  promptLang?: 'zh' | 'en';
  prompts?: Record<string, string>;
  systemPrompt?: string;
  order?: string[];
  mode?: 'batchRename' | 'renameCollection';
  prefix?: string;
  newCollectionName?: string;
}

type PromptLang = 'zh' | 'en';

function resolvePromptLang(lang?: string): PromptLang {
  return lang === 'en' ? 'en' : 'zh';
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolvePromptFromMap(
  promptMap: Record<string, string>,
  originalName: string,
  safeName: string,
  fileIndex: number,
): string {
  const originalBase = originalName.replace(/\.[^/.]+$/, '');
  const safeBase = safeName.replace(/\.[^/.]+$/, '');

  return (
    promptMap[`#${fileIndex}`]
    || promptMap[String(fileIndex)]
    || promptMap[safeName]
    || promptMap[originalName]
    || promptMap[safeBase]
    || promptMap[originalBase]
    || ''
  );
}

@Injectable()
export class DatasetService {
  @Inject(DatasetCollection)
  private datasetCollectionModel!: ModelType<DatasetCollection>;

  @Inject(DatasetEntry)
  private datasetEntryModel!: ModelType<DatasetEntry>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  private async normalizeEntryUrl(
    entry: { collectionName: string; fileName: string; url: string },
  ): Promise<string> {
    const normalized = await tryNormalizeAssetUrlToCdn(entry.url, {
      preferredSubdir: `dataset/${entry.collectionName}`,
      preferredFileName: entry.fileName,
    });

    if (normalized && normalized !== entry.url) {
      await this.datasetEntryModel.updateOne(
        { collectionName: entry.collectionName, fileName: entry.fileName },
        { $set: { url: normalized } },
      );
      await this.imageAssetModel.updateOne(
        { url: entry.url },
        {
          $set: {
            url: normalized,
            dir: `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/dataset/${entry.collectionName}`,
            fileName: entry.fileName,
            region: 'SG',
            type: 'dataset',
            meta: { collection: entry.collectionName },
          },
        },
        { upsert: true },
      );
      return normalized;
    }

    return normalized || entry.url;
  }

  public async getDataset(query: DatasetQuery): Promise<unknown> {
    const collectionName = query.collection ?? null;

    try {
      if (collectionName) {
        const collectionMeta = await this.datasetCollectionModel.findOne({ name: collectionName }).lean();
        if (!collectionMeta) {
          throw new HttpError(404, 'Collection not found');
        }

        const entries = await this.datasetEntryModel.find({ collectionName: collectionName }).lean();
        const orderMap = new Map(
          (collectionMeta.order || []).map((filename, index) => [filename, index]),
        );

        const normalizedEntries = await Promise.all(
          entries.map(async (entry) => ({
            entry,
            url: await this.normalizeEntryUrl({
              collectionName,
              fileName: entry.fileName,
              url: entry.url,
            }),
          })),
        );

        const images = normalizedEntries
          .map(({ entry, url }) => ({
            id: entry.fileName,
            filename: entry.fileName,
            url,
            promptZh: entry.promptZh || entry.prompt || '',
            promptEn: entry.promptEn || '',
            prompt: entry.promptZh || entry.prompt || entry.promptEn || '',
          }))
          .sort((a, b) => {
            const ia = orderMap.get(a.filename);
            const ib = orderMap.get(b.filename);
            if (ia !== undefined && ib !== undefined) return ia - ib;
            if (ia !== undefined) return -1;
            if (ib !== undefined) return 1;
            return a.filename.localeCompare(b.filename);
          });

        return {
          images,
          systemPrompt: collectionMeta.systemPrompt || '',
          order: collectionMeta.order || [],
        };
      }

      const collections = await this.datasetCollectionModel.find().lean();
      const result = await Promise.all(
        collections.map(async (c) => {
          const previewEntries = await this.datasetEntryModel
            .find({ collectionName: c.name })
            .sort({ order: 1 })
            .limit(4)
            .lean();
          const previews = await Promise.all(
            previewEntries.map((entry) => this.normalizeEntryUrl({
              collectionName: c.name,
              fileName: entry.fileName,
              url: entry.url,
            })),
          );
          return {
            id: c.name,
            name: c.name,
            imageCount: await this.datasetEntryModel.countDocuments({ collectionName: c.name }),
            previews,
          };
        }),
      );

      return { collections: result };
    } catch (error) {
      console.error('Dataset API Error:', error);
      throw new HttpError(500, 'Internal Server Error', String(error));
    }
  }

  public async postDataset(params: DatasetPostParams): Promise<unknown> {
    try {
      const { file, collection, mode, newName, promptMap = {} } = params;
      const files = params.files && params.files.length > 0
        ? params.files
        : file
          ? [file]
          : [];

      if (!collection) {
        throw new HttpError(400, 'Collection name is required');
      }

      if (mode === 'duplicate') {
        if (!newName) {
          throw new HttpError(400, 'New collection name is required');
        }

        const exists = await this.datasetCollectionModel.findOne({ name: newName });
        if (exists) {
          throw new HttpError(409, 'Collection already exists');
        }

        const sourceEntries = await this.datasetEntryModel.find({ collectionName: collection }).lean();
        const sessionData = sourceEntries.map((e) => ({
          collectionName: newName,
          fileName: e.fileName,
          url: e.url,
          prompt: e.prompt,
          promptZh: e.promptZh,
          promptEn: e.promptEn,
          order: e.order,
        }));

        await this.datasetCollectionModel.create({
          name: newName,
          systemPrompt: (await this.datasetCollectionModel.findOne({ name: collection }))?.systemPrompt,
          order: sourceEntries.map((e) => e.fileName),
        });
        if (sessionData.length > 0) {
          await this.datasetEntryModel.insertMany(sessionData as unknown as DatasetEntry[]);
        }
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection duplicated' };
      }

      await this.datasetCollectionModel.updateOne(
        { name: collection },
        { $setOnInsert: { name: collection, order: [] } },
        { upsert: true },
      );

      if (mode === 'batchUpload' && files.length === 0) {
        throw new HttpError(400, 'At least one file is required for batchUpload');
      }

      if (files.length === 0) {
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection created' };
      }

      const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/dataset/${collection}`;
      let currentCount = await this.datasetEntryModel.countDocuments({ collectionName: collection });
      const collectionMeta = await this.datasetCollectionModel.findOne({ name: collection }).lean();
      const existingOrder = new Set(collectionMeta?.order || []);
      const orderToAppend: string[] = [];
      const uploaded: Array<{ filename: string; url: string; prompt: string }> = [];

      for (let index = 0; index < files.length; index += 1) {
        const currentFile = files[index];
        const buffer = Buffer.from(await currentFile.arrayBuffer());
        const safeName = sanitizeFileName(currentFile.name);
        const cdn = await uploadBufferToCdn(buffer, { fileName: safeName, dir, region: 'SG' });
        const prompt = resolvePromptFromMap(promptMap, currentFile.name, cdn.fileName, index);

        await this.imageAssetModel.create({
          url: cdn.url,
          dir: cdn.dir,
          fileName: cdn.fileName,
          region: 'SG',
          type: 'dataset',
          meta: { collection },
        });

        const existingEntry = await this.datasetEntryModel.findOne({
          collectionName: collection,
          fileName: cdn.fileName,
        }).lean();

        if (existingEntry) {
          const nextPromptZh = prompt || existingEntry.promptZh || existingEntry.prompt || '';
          const nextPromptEn = existingEntry.promptEn || '';
          await this.datasetEntryModel.updateOne(
            { collectionName: collection, fileName: cdn.fileName },
            {
              url: cdn.url,
              prompt: nextPromptZh || nextPromptEn,
              promptZh: nextPromptZh,
              promptEn: nextPromptEn,
            },
          );
        } else {
          await this.datasetEntryModel.create({
            collectionName: collection,
            fileName: cdn.fileName,
            url: cdn.url,
            prompt: prompt || '',
            promptZh: prompt || '',
            promptEn: '',
            order: currentCount,
          });
          currentCount += 1;
        }

        if (!existingOrder.has(cdn.fileName)) {
          existingOrder.add(cdn.fileName);
          orderToAppend.push(cdn.fileName);
        }

        uploaded.push({
          filename: cdn.fileName,
          url: cdn.url,
          prompt,
        });
      }

      if (orderToAppend.length > 0) {
        await this.datasetCollectionModel.updateOne(
          { name: collection },
          { $push: { order: { $each: orderToAppend } } },
        );
      }

      datasetEvents.emit(DATASET_SYNC_EVENT);

      if (mode === 'batchUpload' || files.length > 1) {
        return {
          success: true,
          message: `Uploaded ${uploaded.length} files`,
          uploaded,
        };
      }

      return { success: true, path: uploaded[0]?.url };
    } catch (error) {
      console.error('Dataset Upload Error:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Upload Failed', String(error));
    }
  }

  public async deleteDataset(params: DatasetDeleteParams): Promise<unknown> {
    try {
      const { collection, filename, filenames } = params;

      if (!collection) {
        throw new HttpError(400, 'Collection name is required');
      }

      let filenamesToDelete: string[] = [];
      if (filenames) {
        filenamesToDelete = filenames.split(',').filter((f) => f.trim() !== '');
      } else if (filename) {
        filenamesToDelete = [filename];
      }

      if (filenamesToDelete.length === 0 && !filename && !filenames) {
        await this.datasetEntryModel.deleteMany({ collectionName: collection });
        await this.datasetCollectionModel.deleteOne({ name: collection });
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection deleted' };
      }

      if (filenamesToDelete.length > 0) {
        await this.datasetEntryModel.deleteMany({ collectionName: collection, fileName: { $in: filenamesToDelete } });
        await this.datasetCollectionModel.updateOne(
          { name: collection },
          { $pull: { order: { $in: filenamesToDelete } } },
        );
      }

      datasetEvents.emit(DATASET_SYNC_EVENT);
      return {
        success: true,
        message:
          filenamesToDelete.length > 0
            ? `Deleted ${filenamesToDelete.length} files`
            : 'Deleted successfully',
      };
    } catch (error) {
      console.error('Dataset Delete Error:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Delete Failed', String(error));
    }
  }

  public async updateDataset(body: DatasetUpdateBody): Promise<unknown> {
    try {
      const { collection, filename, prompt, systemPrompt, order } = body;
      const writePromptLang = resolvePromptLang(body.promptLang);

      if (!collection) {
        throw new HttpError(400, 'Collection name is required');
      }

      if (body.mode === 'batchRename') {
        throw new HttpError(400, 'batchRename is not supported for CDN files');
      }

      if (filename) {
        const promptStr = typeof prompt === 'string' ? prompt : '';
        await this.datasetEntryModel.updateOne(
          { collectionName: collection, fileName: filename },
          writePromptLang === 'en'
            ? { prompt: promptStr, promptEn: promptStr }
            : { prompt: promptStr, promptZh: promptStr },
        );
      }

      if (body.prompts) {
        const updates = Object.entries(body.prompts);
        for (const [fileName, p] of updates) {
          const promptStr = typeof p === 'string' ? p : '';
          await this.datasetEntryModel.updateOne(
            { collectionName: collection, fileName },
            writePromptLang === 'en'
              ? { prompt: promptStr, promptEn: promptStr }
              : { prompt: promptStr, promptZh: promptStr },
          );
        }
      }

      if (systemPrompt !== undefined) {
        await this.datasetCollectionModel.updateOne({ name: collection }, { systemPrompt }, { upsert: true });
      }

      if (order !== undefined && Array.isArray(order)) {
        await this.datasetCollectionModel.updateOne({ name: collection }, { order }, { upsert: true });
        const bulk = this.datasetEntryModel.collection.initializeUnorderedBulkOp();
        let ops = 0;
        order.forEach((fileName, idx) => {
          bulk.find({ collectionName: collection, fileName }).updateOne({ $set: { order: idx } });
          ops += 1;
        });
        if (ops > 0) {
          await bulk.execute();
        }
      }

      if (body.newCollectionName && body.newCollectionName !== collection) {
        const exists = await this.datasetCollectionModel.findOne({ name: body.newCollectionName });
        if (exists) {
          throw new HttpError(409, 'Collection with this name already exists');
        }
        await this.datasetCollectionModel.updateOne(
          { name: collection },
          { name: body.newCollectionName },
          { upsert: true },
        );
        await this.datasetEntryModel.updateMany({ collectionName: collection }, { collectionName: body.newCollectionName });
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return {
          success: true,
          message: 'Collection renamed',
          newCollectionName: body.newCollectionName,
        };
      }

      datasetEvents.emit(DATASET_SYNC_EVENT);
      return { success: true, message: 'Metadata updated' };
    } catch (error) {
      console.error('Dataset Update Error:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Update Failed', String(error));
    }
  }
}
