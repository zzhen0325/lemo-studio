import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Generation as GenerationEntity, ImageAsset } from '../db';
import type { Generation, GenerationConfig } from '../../types/database';
import { isValidObjectId } from '@byted/bytedmongoose';
import type { UpdateQuery } from '@byted/bytedmongoose';
import { sanitizeMongoKeys, restoreMongoKeys } from '../utils/mongo';

export interface HistoryQuery {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
}

@Injectable()
export class HistoryService {
  @Inject(GenerationEntity)
  private generationModel!: ModelType<GenerationEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async getHistory(query: HistoryQuery): Promise<{ history: Generation[]; total: number; hasMore: boolean }> {
    const { page, limit, projectId, userId } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;

    // 自动清理过期记录：改为概率触发 (1%) 且非阻塞
    if (Math.random() < 0.01) {
      this.cleanupStaleGenerations().catch(err => console.error('Background cleanup failed:', err));
    }

    try {
      const filter: Record<string, unknown> = {};
      if (projectId && projectId !== 'null' && projectId !== 'undefined') {
        filter.projectId = projectId;
      }
      if (userId) {
        filter.userId = userId;
      }

      const total = await this.generationModel.countDocuments(filter);
      const items = await this.generationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select('-config.editConfig -llmResponse') // 大幅度减少 Payload，列表不需要这些字段
        .populate(['outputImageId', 'sourceImageId'])
        .lean();

      const history = items.map((item) => {
        const restoredItem = restoreMongoKeys(item) as Record<string, unknown>;
        const outputImage = restoredItem.outputImageId as { url?: string } | undefined;
        const storedSourceUrls = (restoredItem as Record<string, unknown>).sourceImageUrls as string[] | undefined;
        const restoredConfig = (restoredItem.config || {}) as Record<string, unknown>;
        const singleSourceUrl = outputImage?.url || (restoredConfig.sourceImageUrl as string | undefined);

        // 规范化 sourceImageUrls：统一到 config 内
        const sourceImageUrls = (Array.isArray(restoredConfig.sourceImageUrls) && restoredConfig.sourceImageUrls.length > 0)
          ? restoredConfig.sourceImageUrls
          : storedSourceUrls && storedSourceUrls.length > 0
            ? storedSourceUrls
            : (singleSourceUrl ? [singleSourceUrl] : []);

        // 规范化 localSourceIds：统一到 config 内
        const localSourceIds = (Array.isArray(restoredConfig.localSourceIds) && restoredConfig.localSourceIds.length > 0)
          ? restoredConfig.localSourceIds
          : (restoredItem as Record<string, unknown>).localSourceIds as string[] ||
          (restoredConfig.localSourceId ? [restoredConfig.localSourceId] : []);

        return {
          id: String(restoredItem._id),
          userId: (restoredItem.userId as string) || 'anonymous',
          projectId: (restoredItem.projectId as string) || 'default',
          outputUrl: outputImage?.url || (restoredItem.outputUrl as string | undefined),
          config: {
            ...restoredConfig,
            sourceImageUrls,
            localSourceIds,
          },
          status: (restoredItem.status as 'pending' | 'completed' | 'failed') || 'completed',
          createdAt: String(restoredItem.createdAt || new Date().toISOString()),
          progress: restoredItem.progress as number | undefined,
          progressStage: restoredItem.progressStage as string | undefined,
          llmResponse: restoredItem.llmResponse as string | undefined,
        } as Generation;
      });


      return {
        history,
        total,
        hasMore: (pageNum - 1) * limitNum + history.length < total,
      };
    } catch (error) {
      console.error('Failed to load history:', error);
      throw new HttpError(500, 'Failed to load history');
    }
  }

  public async saveHistory(body: unknown): Promise<{ success: true }> {
    try {
      const bodyObj = body as Record<string, unknown>;
      if (bodyObj.action === 'batch-update' && Array.isArray(bodyObj.items)) {
        const items = bodyObj.items as Generation[];
        for (const item of items) {
          if (!item.id || !isValidObjectId(item.id)) continue;
          const sanitizedItem = sanitizeMongoKeys(item);
          await this.generationModel.updateOne({ _id: item.id }, { $set: sanitizedItem as Partial<GenerationEntity> });
        }
        return { success: true };
      }

      if (bodyObj.action === 'sync-image' && bodyObj.localId && bodyObj.path) {
        // 更新所有匹配 localSourceId 的记录
        await this.generationModel.updateMany(
          { 'config.localSourceId': bodyObj.localId },
          {
            $set: { 'config.sourceImageUrl': bodyObj.path },
            // Also update first element of sourceImageUrls if it exists
          }
        );
        // Update sourceImageUrls array - replace first element
        await this.generationModel.updateMany(
          { 'config.localSourceId': bodyObj.localId, 'config.sourceImageUrls.0': { $exists: true } },
          { $set: { 'config.sourceImageUrls.0': bodyObj.path } }
        );
        return { success: true };
      }

      const item = body as Generation;
      if (!item || (!item.outputUrl && !item.id)) {
        throw new HttpError(400, 'Invalid item');
      }

      const cfg = (item.config || {}) as GenerationConfig;

      // 优先从 config 中读取 sourceImageUrls，兼容旧数据结构
      const effectiveSourceImageUrls = cfg.sourceImageUrls || (item as unknown as Record<string, unknown>).sourceImageUrls || [];
      const effectiveLocalSourceIds = cfg.localSourceIds || (item as unknown as Record<string, unknown>).localSourceIds || [];

      const record = {
        userId: item.userId || 'anonymous',
        projectId: item.projectId || 'default',
        outputUrl: item.outputUrl,
        config: {
          ...cfg,
          sourceImageUrls: effectiveSourceImageUrls,
          localSourceIds: effectiveLocalSourceIds,
        },
        status: item.status || 'completed',
        progress: item.progress,
        progressStage: item.progressStage,
        llmResponse: item.llmResponse,
        createdAt: item.createdAt || new Date().toISOString(),
      };


      const existing =
        item.id && isValidObjectId(item.id)
          ? await this.generationModel.findById(item.id)
          : item.outputUrl
            ? await this.generationModel.findOne({ outputUrl: item.outputUrl })
            : null;

      const sanitizedRecord = sanitizeMongoKeys(record);

      if (existing) {
        await this.generationModel.updateOne(
          { _id: existing._id },
          { $set: sanitizedRecord } as UpdateQuery<GenerationEntity>,
        );
      } else {
        const newDoc = await this.generationModel.create(sanitizedRecord);
        if (item.outputUrl) {
          await this.imageAssetModel.updateOne(
            { url: item.outputUrl },
            { $set: { type: 'generation', generationId: String(newDoc._id) } },
            { upsert: true },
          );
          const outputImage = await this.imageAssetModel.findOne({ url: item.outputUrl });
          await this.generationModel.updateOne({ _id: newDoc._id }, { outputImageId: outputImage?._id });
        }
      }

      // 移除原有的在末尾单独更新 editConfig 的逻辑，因为上面已经整合进 record 了

      return { success: true };
    } catch (error) {
      console.error('Failed to save history item:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to save history item');
    }
  }

  public async deleteHistory(ids: string[]): Promise<{ success: true }> {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new HttpError(400, 'Invalid IDs');
      }

      const validIds = ids.filter((id) => isValidObjectId(id));
      if (validIds.length === 0) {
        throw new HttpError(400, 'No valid IDs provided');
      }

      await this.generationModel.deleteMany({ _id: { $in: validIds } });
      return { success: true };
    } catch (error) {
      console.error('Failed to delete history:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to delete history');
    }
  }

  public async cleanupStaleGenerations(): Promise<void> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const result = await this.generationModel.deleteMany({
        status: 'pending',
        createdAt: { $lt: tenMinutesAgo }
      });
      const deletedCount = result.deletedCount ?? 0;
      if (deletedCount > 0) {
        console.log(`[HistoryService] Cleaned up ${deletedCount} stale generation records.`);
      }
    } catch (error) {
      console.error('[HistoryService] Failed to cleanup stale generations:', error);
    }
  }
}
