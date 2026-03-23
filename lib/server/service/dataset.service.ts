import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { datasetEvents, DATASET_SYNC_EVENT } from '../dataset-events';
import { HttpError } from '../utils/http-error';
import { uploadBufferToCdn } from '../utils/cdn';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';
import { restoreMongoKeys } from '../utils/mongo';
import { getFileUrl } from '@/src/storage/object-storage';
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

/**
 * Check if a string is a storage key (not a full URL)
 */
function isStorageKey(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return false;
  }
  return value.includes('/');
}

/**
 * Extract storage key from a presigned URL (TOS/S3 URLs)
 */
function extractStorageKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Check if it's a TOS/S3 URL pattern
    if (!parsed.hostname.includes('tos.coze.site') && !parsed.hostname.includes('tiktokcdn.com')) {
      return null;
    }
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    // Skip the bucket name (first part like coze_storage_xxx)
    if (pathParts.length < 2) {
      return null;
    }
    
    let keyStartIndex = 0;
    if (pathParts[0].startsWith('coze_storage_')) {
      keyStartIndex = 1;
    }
    
    if (keyStartIndex >= pathParts.length) {
      return null;
    }
    
    return pathParts.slice(keyStartIndex).join('/') || null;
  } catch {
    return null;
  }
}

/**
 * Get display URL from storage key or presigned URL
 * - If it's a storage key, generate presigned URL
 * - If it's a presigned URL, extract storage key and regenerate presigned URL
 */
async function getDisplayUrl(value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  
  if (isStorageKey(value)) {
    // It's a storage key, generate presigned URL
    return getFileUrl(value);
  }
  
  // It's a URL - try to extract storage key and regenerate presigned URL
  const storageKey = extractStorageKeyFromUrl(value);
  if (storageKey) {
    // Generate fresh presigned URL from storage key
    return getFileUrl(storageKey);
  }
  
  // Not a storage URL, return as-is
  return value;
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
    // First, try to extract storage key from the URL (handles expired presigned URLs)
    let storageKey: string | null = null;
    
    if (isStorageKey(entry.url)) {
      // Already a storage key
      storageKey = entry.url;
    } else {
      // Try to extract storage key from presigned URL
      storageKey = extractStorageKeyFromUrl(entry.url);
    }
    
    // If we have a storage key, update database and return presigned URL
    if (storageKey) {
      // Update database with storage key if needed
      if (storageKey !== entry.url) {
        await this.datasetEntryModel.updateOne(
          { collection_name: entry.collectionName, file_name: entry.fileName },
          { $set: { url: storageKey } },
        );
        await this.imageAssetModel.updateOne(
          { url: entry.url },
          {
            $set: {
              url: storageKey,
              dir: `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/dataset/${entry.collectionName}`,
              fileName: entry.fileName,
              region: 'SG',
              type: 'dataset',
              meta: { collection: entry.collectionName },
            },
          },
          { upsert: true },
        );
      }
      
      // Return fresh presigned URL for display
      return (await getDisplayUrl(storageKey)) || entry.url;
    }
    
    // Fallback: try to normalize and upload to CDN
    const normalized = await tryNormalizeAssetUrlToCdn(entry.url, {
      preferredSubdir: `dataset/${entry.collectionName}`,
      preferredFileName: entry.fileName,
    });

    const newStorageKey = normalized.storageKey || normalized.url;
    
    if (!newStorageKey) {
      // Return original URL if normalization failed
      return entry.url;
    }

    // Update database with new storage key
    if (newStorageKey !== entry.url) {
      await this.datasetEntryModel.updateOne(
        { collection_name: entry.collectionName, file_name: entry.fileName },
        { $set: { url: newStorageKey } },
      );
      await this.imageAssetModel.updateOne(
        { url: entry.url },
        {
          $set: {
            url: newStorageKey,
            dir: `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/dataset/${entry.collectionName}`,
            fileName: entry.fileName,
            region: 'SG',
            type: 'dataset',
            meta: { collection: entry.collectionName },
          },
        },
        { upsert: true },
      );
    }
    
    // Return presigned URL for display
    return (await getDisplayUrl(newStorageKey)) || entry.url;
  }

  public async getDataset(query: DatasetQuery): Promise<unknown> {
    const collectionName = query.collection ?? null;

    try {
      if (collectionName) {
        const rawCollectionMeta = await this.datasetCollectionModel.findOne({ name: collectionName }).lean();
        if (!rawCollectionMeta) {
          throw new HttpError(404, 'Collection not found');
        }
        const collectionMeta = restoreMongoKeys(rawCollectionMeta) as Record<string, unknown>;

        const rawEntries = await this.datasetEntryModel.find({ collection_name: collectionName }).lean();
        const entries = restoreMongoKeys(rawEntries) as Array<Record<string, unknown>>;
        const orderMap = new Map(
          ((collectionMeta.orderArr || collectionMeta.order || []) as string[]).map((filename, index) => [filename, index]),
        );

        const normalizedEntries = await Promise.all(
          entries.map(async (entry) => ({
            entry,
            url: await this.normalizeEntryUrl({
              collectionName,
              fileName: (entry.fileName || entry.file_name) as string,
              url: entry.url as string,
            }),
          })),
        );

        const images = normalizedEntries
          .map(({ entry, url }) => ({
            id: (entry.fileName || entry.file_name) as string,
            filename: (entry.fileName || entry.file_name) as string,
            url,
            promptZh: (entry.promptZh || entry.prompt_zh || entry.prompt || '') as string,
            promptEn: (entry.promptEn || entry.prompt_en || '') as string,
            prompt: (entry.promptZh || entry.prompt_zh || entry.prompt || entry.promptEn || entry.prompt_en || '') as string,
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
          systemPrompt: (collectionMeta.systemPrompt || collectionMeta.system_prompt || '') as string,
          order: (collectionMeta.orderArr || collectionMeta.order || []) as string[],
        };
      }

      const rawCollections = await this.datasetCollectionModel.find().lean();
      const collections = restoreMongoKeys(rawCollections) as Array<Record<string, unknown>>;
      const result = await Promise.all(
        collections.map(async (c) => {
          const rawPreviewEntries = await this.datasetEntryModel
            .find({ collection_name: c.name })
            .sort({ order_idx: 1 })
            .limit(4)
            .lean();
          const previewEntries = restoreMongoKeys(rawPreviewEntries) as Array<Record<string, unknown>>;
          const previews = await Promise.all(
            previewEntries.map((entry) => this.normalizeEntryUrl({
              collectionName: c.name as string,
              fileName: (entry.fileName || entry.file_name) as string,
              url: entry.url as string,
            })),
          );
          return {
            id: c.name,
            name: c.name,
            imageCount: await this.datasetEntryModel.countDocuments({ collection_name: c.name }),
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

        const rawSourceEntries = await this.datasetEntryModel.find({ collection_name: collection }).lean();
        const sourceEntries = restoreMongoKeys(rawSourceEntries) as Array<Record<string, unknown>>;
        const sessionData = sourceEntries.map((e) => ({
          collectionName: newName,
          fileName: (e.fileName || e.file_name) as string,
          url: e.url as string,
          prompt: e.prompt as string,
          promptZh: (e.promptZh || e.prompt_zh) as string,
          promptEn: (e.promptEn || e.prompt_en) as string,
          order: (e.orderIdx || e.order_idx || e.order) as number,
        }));

        const rawCollectionMeta = await this.datasetCollectionModel.findOne({ name: collection }).lean();
        const collectionMeta = restoreMongoKeys(rawCollectionMeta) as Record<string, unknown> | null;
        
        await this.datasetCollectionModel.create({
          name: newName,
          systemPrompt: (collectionMeta?.systemPrompt || collectionMeta?.system_prompt) as string | undefined,
          order: sourceEntries.map((e) => (e.fileName || e.file_name) as string),
        });
        if (sessionData.length > 0) {
          await this.datasetEntryModel.insertMany(sessionData as unknown as DatasetEntry[]);
        }
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection duplicated' };
      }

      // Check if collection exists, create if not
      const existingCollection = await this.datasetCollectionModel.findOne({ name: collection }).lean();
      if (!existingCollection) {
        await this.datasetCollectionModel.create({
          name: collection,
          order: [],
        });
      }

      if (mode === 'batchUpload' && files.length === 0) {
        throw new HttpError(400, 'At least one file is required for batchUpload');
      }

      if (files.length === 0) {
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection created' };
      }

      const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/dataset/${collection}`;
      let currentCount = await this.datasetEntryModel.countDocuments({ collection_name: collection });
      const rawCollectionMeta = await this.datasetCollectionModel.findOne({ name: collection }).lean();
      const collectionMeta = restoreMongoKeys(rawCollectionMeta) as Record<string, unknown> | null;
      const existingOrder = new Set((collectionMeta?.orderArr || collectionMeta?.order || []) as string[]);
      const orderToAppend: string[] = [];
      const uploaded: Array<{ filename: string; url: string; prompt: string }> = [];

      for (let index = 0; index < files.length; index += 1) {
        const currentFile = files[index];
        const buffer = Buffer.from(await currentFile.arrayBuffer());
        const safeName = sanitizeFileName(currentFile.name);
        const cdn = await uploadBufferToCdn(buffer, { fileName: safeName, dir, region: 'SG', generateSignedUrl: true });
        const prompt = resolvePromptFromMap(promptMap, currentFile.name, cdn.fileName, index);

        await this.imageAssetModel.create({
          url: cdn.url,
          dir: cdn.dir,
          fileName: cdn.fileName,
          region: 'SG',
          type: 'dataset',
          meta: { collection },
        });

        const rawExistingEntry = await this.datasetEntryModel.findOne({
          collection_name: collection,
          file_name: cdn.fileName,
        }).lean();
        const existingEntry = rawExistingEntry ? restoreMongoKeys(rawExistingEntry) as Record<string, unknown> : null;

        if (existingEntry) {
          const nextPromptZh = prompt || (existingEntry.promptZh || existingEntry.prompt_zh || existingEntry.prompt) as string || '';
          const nextPromptEn = (existingEntry.promptEn || existingEntry.prompt_en) as string || '';
          await this.datasetEntryModel.updateOne(
            { collection_name: collection, file_name: cdn.fileName },
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
        // Get current order and update with new items
        const currentOrder = [...((collectionMeta?.orderArr || collectionMeta?.order || []) as string[]), ...orderToAppend];
        await this.datasetCollectionModel.updateOne(
          { name: collection },
          { order: currentOrder },
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
        await this.datasetEntryModel.deleteMany({ collection_name: collection });
        await this.datasetCollectionModel.deleteOne({ name: collection });
        datasetEvents.emit(DATASET_SYNC_EVENT);
        return { success: true, message: 'Collection deleted' };
      }

      if (filenamesToDelete.length > 0) {
        // Delete entries matching filenames
        for (const fn of filenamesToDelete) {
          await this.datasetEntryModel.deleteOne({ collection_name: collection, file_name: fn });
        }
        
        // Update collection order - remove deleted filenames
        const rawCollectionMeta = await this.datasetCollectionModel.findOne({ name: collection }).lean();
        const collectionMeta = restoreMongoKeys(rawCollectionMeta) as Record<string, unknown> | null;
        const currentOrder = (collectionMeta?.orderArr || collectionMeta?.order || []) as string[];
        const newOrder = currentOrder.filter(fn => !filenamesToDelete.includes(fn));
        await this.datasetCollectionModel.updateOne(
          { name: collection },
          { order: newOrder },
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
          { collection_name: collection, file_name: filename },
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
            { collection_name: collection, file_name: fileName },
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
        // Update order for each entry individually
        for (let idx = 0; idx < order.length; idx += 1) {
          const fileName = order[idx];
          await this.datasetEntryModel.updateOne(
            { collection_name: collection, file_name: fileName },
            { order: idx },
          );
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
        await this.datasetEntryModel.updateMany({ collection_name: collection }, { collectionName: body.newCollectionName });
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
