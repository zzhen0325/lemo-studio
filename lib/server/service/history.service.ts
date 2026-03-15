import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { HttpError } from '../utils/http-error';
import { Generation as GenerationEntity, ImageAsset } from '../db';
import type { Generation, GenerationConfig } from '../../../types/database';
import { isValidObjectId } from '@byted/bytedmongoose';
import type { UpdateQuery } from '@byted/bytedmongoose';
import { sanitizeMongoKeys, restoreMongoKeys } from '../utils/mongo';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';

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

  private async normalizeGenerationUrls(itemId: string, outputUrl?: string, sourceImageUrls: string[] = []) {
    const normalizedOutputUrl = outputUrl
      ? (await tryNormalizeAssetUrlToCdn(outputUrl, { preferredSubdir: 'outputs' })) || outputUrl
      : undefined;
    const normalizedSourceImageUrls = await Promise.all(
      sourceImageUrls.map(async (sourceImageUrl) => {
        const normalized = await tryNormalizeAssetUrlToCdn(sourceImageUrl, { preferredSubdir: 'upload' });
        return normalized || sourceImageUrl;
      }),
    );

    const changedOutput = normalizedOutputUrl !== outputUrl;
    const changedSources = normalizedSourceImageUrls.some((value, index) => value !== sourceImageUrls[index]);

    if (itemId && (changedOutput || changedSources)) {
      const updatePayload: Record<string, unknown> = {};
      if (changedOutput) {
        updatePayload.outputUrl = normalizedOutputUrl;
      }
      if (changedSources) {
        updatePayload['config.sourceImageUrls'] = normalizedSourceImageUrls;
        updatePayload['config.sourceImageUrl'] = normalizedSourceImageUrls[0];
      }
      await this.generationModel.updateOne({ _id: itemId }, { $set: updatePayload });
    }

    return {
      outputUrl: normalizedOutputUrl,
      sourceImageUrls: normalizedSourceImageUrls,
    };
  }

  public async getHistory(query: HistoryQuery): Promise<{ history: Generation[]; total: number; hasMore: boolean }> {
    const { page, limit, projectId, userId } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const debugHistory = process.env.DEBUG_HISTORY === 'true' || process.env.HISTORY_DEBUG === '1';

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

      if (debugHistory) {
        console.info('[HistoryDebug][Server] query', {
          page: pageNum,
          limit: limitNum,
          projectId: projectId || null,
          userId: userId || null,
          filter,
        });
      }

      // 使用估算值加速计数（精确计数在大表上很慢）
      const total = Object.keys(filter).length === 0
        ? await this.generationModel.estimatedDocumentCount()
        : await this.generationModel.countDocuments(filter);
      const items = await this.generationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select('-config.editConfig -config.imageEditorSession -config.tldrawSnapshot -config.canvasJson -config.referenceImages -llmResponse') // 大幅度减少 Payload
        // 移除 populate 以加速查询，列表页不需要完整的关联数据
        .lean();

      if (debugHistory) {
        const sampleUserIds = items.slice(0, 5).map((item) => (item as unknown as { userId?: string }).userId || null);
        console.info('[HistoryDebug][Server] db_result', {
          total,
          fetched: items.length,
          hasMore: (pageNum - 1) * limitNum + items.length < total,
          sampleUserIds,
        });
      }

      const history = await Promise.all(items.map(async (item) => {
        const restoredItem = restoreMongoKeys(item) as Record<string, unknown>;
        const storedSourceUrls = (restoredItem as Record<string, unknown>).sourceImageUrls as string[] | undefined;
        const restoredConfig = (restoredItem.config || {}) as Record<string, unknown>;
        // 直接使用 outputUrl 字段（不再依赖 populate）
        const outputUrl = (restoredItem.outputUrl as string | undefined) || (restoredConfig.outputUrl as string | undefined);
        const singleSourceUrl = (restoredConfig.sourceImageUrl as string | undefined);

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

        const normalizedUrls = await this.normalizeGenerationUrls(
          String(restoredItem._id),
          outputUrl,
          sourceImageUrls,
        );

        return {
          id: String(restoredItem._id),
          userId: (restoredItem.userId as string) || 'anonymous',
          projectId: (restoredItem.projectId as string) || 'default',
          outputUrl: normalizedUrls.outputUrl,
          config: {
            ...restoredConfig,
            sourceImageUrls: normalizedUrls.sourceImageUrls,
            localSourceIds,
          },
          status: (restoredItem.status as 'pending' | 'completed' | 'failed') || 'completed',
          createdAt: String(restoredItem.createdAt || new Date().toISOString()),
          progress: restoredItem.progress as number | undefined,
          progressStage: restoredItem.progressStage as string | undefined,
          llmResponse: restoredItem.llmResponse as string | undefined,
        } as Generation;
      }));


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

  public async saveHistory(body: unknown): Promise<{ success: true; migratedCount?: number }> {
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

      if (bodyObj.action === 'migrate-user-history') {
        const fromUserId = typeof bodyObj.fromUserId === 'string' ? bodyObj.fromUserId.trim() : '';
        const toUserId = typeof bodyObj.toUserId === 'string' ? bodyObj.toUserId.trim() : '';

        if (!fromUserId || !toUserId) {
          throw new HttpError(400, 'fromUserId and toUserId are required');
        }
        if (fromUserId === toUserId) {
          return { success: true, migratedCount: 0 };
        }

        const result = await this.generationModel.updateMany(
          { userId: fromUserId },
          { $set: { userId: toUserId } },
        );

        // bytedmongoose/mongoose versions may expose different fields on update result
        const updateResult = result as unknown as {
          modifiedCount?: number;
          nModified?: number;
          result?: { modifiedCount?: number; nModified?: number };
        };
        const migratedCount =
          updateResult.modifiedCount ??
          updateResult.nModified ??
          updateResult.result?.modifiedCount ??
          updateResult.result?.nModified ??
          0;

        return { success: true, migratedCount };
      }

      const item = body as Generation;
      if (!item || (!item.outputUrl && !item.id)) {
        throw new HttpError(400, 'Invalid item');
      }

      const cfg = (item.config || {}) as GenerationConfig;

      // 优先从 config 中读取 sourceImageUrls，兼容旧数据结构
      const effectiveSourceImageUrls = Array.isArray(cfg.sourceImageUrls)
        ? cfg.sourceImageUrls
        : Array.isArray((item as unknown as Record<string, unknown>).sourceImageUrls)
          ? ((item as unknown as Record<string, unknown>).sourceImageUrls as string[])
          : [];
      const effectiveLocalSourceIds = Array.isArray(cfg.localSourceIds)
        ? cfg.localSourceIds
        : Array.isArray((item as unknown as Record<string, unknown>).localSourceIds)
          ? ((item as unknown as Record<string, unknown>).localSourceIds as string[])
          : [];

      const normalizedOutputUrl = item.outputUrl
        ? (await tryNormalizeAssetUrlToCdn(item.outputUrl, { preferredSubdir: 'outputs' })) || item.outputUrl
        : item.outputUrl;
      const normalizedSourceImageUrls = await Promise.all(
        (effectiveSourceImageUrls || []).map(async (sourceImageUrl) => {
          const normalized = await tryNormalizeAssetUrlToCdn(sourceImageUrl, { preferredSubdir: 'upload' });
          return normalized || sourceImageUrl;
        }),
      );

      const record = {
        userId: item.userId || 'anonymous',
        projectId: item.projectId || 'default',
        outputUrl: normalizedOutputUrl,
        config: {
          ...cfg,
          sourceImageUrls: normalizedSourceImageUrls,
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
        if (normalizedOutputUrl) {
          await this.imageAssetModel.updateOne(
            { url: normalizedOutputUrl },
            { $set: { type: 'generation', generationId: String(newDoc._id) } },
            { upsert: true },
          );
          const outputImage = await this.imageAssetModel.findOne({ url: normalizedOutputUrl });
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
      void result;
    } catch (error) {
      console.error('[HistoryService] Failed to cleanup stale generations:', error);
    }
  }
}
