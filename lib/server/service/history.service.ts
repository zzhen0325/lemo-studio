import { HttpError } from '../utils/http-error';
import { GenerationModel, type GenerationDoc } from '../db/models';
import type { Generation, GenerationConfig } from '../../../types/database';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';

export interface HistoryQuery {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
}

// Simple UUID validation
function isValidId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class HistoryService {
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
      const updatePayload: Partial<GenerationDoc> = {};
      if (changedOutput) {
        updatePayload.output_url = normalizedOutputUrl;
      }
      if (changedSources) {
        updatePayload.config = {
          ...(updatePayload.config || {}),
          sourceImageUrls: normalizedSourceImageUrls,
          sourceImageUrl: normalizedSourceImageUrls[0],
        };
      }
      await GenerationModel.updateOne({ id: itemId }, updatePayload);
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

    // Auto cleanup old records with 1% probability
    if (Math.random() < 0.01) {
      this.cleanupStaleGenerations().catch(err => console.error('Background cleanup failed:', err));
    }

    try {
      const filter: Record<string, unknown> = {};
      if (projectId && projectId !== 'null' && projectId !== 'undefined') {
        filter.project_id = projectId;
      }
      if (userId) {
        filter.user_id = userId;
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

      // Get total count
      const total = Object.keys(filter).length === 0
        ? await GenerationModel.estimatedDocumentCount()
        : await GenerationModel.countDocuments(filter);

      // Get items with pagination
      const items = await GenerationModel.findWithPagination(filter, {
        sort: { created_at: -1 },
        skip: (pageNum - 1) * limitNum,
        limit: limitNum,
        select: 'id,user_id,project_id,output_url,config,status,created_at,progress,progress_stage',
      });

      if (debugHistory) {
        const sampleUserIds = items.slice(0, 5).map((item) => item.user_id || null);
        console.info('[HistoryDebug][Server] db_result', {
          total,
          fetched: items.length,
          hasMore: (pageNum - 1) * limitNum + items.length < total,
          sampleUserIds,
        });
      }

      const history = await Promise.all(items.map(async (item) => {
        const config = (item.config || {}) as Record<string, unknown>;
        const outputUrl = item.output_url || (config.outputUrl as string | undefined);
        const singleSourceUrl = config.sourceImageUrl as string | undefined;
        const sourceImageUrls = (Array.isArray(config.sourceImageUrls) && config.sourceImageUrls.length > 0)
          ? config.sourceImageUrls as string[]
          : singleSourceUrl ? [singleSourceUrl] : [];
        const localSourceIds = (Array.isArray(config.localSourceIds) && config.localSourceIds.length > 0)
          ? config.localSourceIds as string[]
          : config.localSourceId ? [config.localSourceId as string] : [];

        const normalizedUrls = await this.normalizeGenerationUrls(
          item.id,
          outputUrl,
          sourceImageUrls,
        );

        return {
          id: item.id,
          userId: item.user_id || 'anonymous',
          projectId: item.project_id || 'default',
          outputUrl: normalizedUrls.outputUrl,
          config: {
            ...config,
            sourceImageUrls: normalizedUrls.sourceImageUrls,
            localSourceIds,
          },
          status: item.status || 'completed',
          createdAt: item.created_at || new Date().toISOString(),
          progress: item.progress,
          progressStage: item.progress_stage,
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
          if (!item.id || !isValidId(item.id)) continue;
          await GenerationModel.updateOne({ id: item.id }, {
            output_url: item.outputUrl,
            config: item.config as Record<string, unknown>,
            status: item.status,
          });
        }
        return { success: true };
      }

      if (bodyObj.action === 'sync-image' && bodyObj.localId && bodyObj.path) {
        // Update all records matching localSourceId in config
        // For Supabase, this requires a different approach
        console.log('[HistoryService] sync-image action not fully implemented for Supabase');
        return { success: true };
      }

      if (bodyObj.action === 'migrate-user-history') {
        const fromUserId = typeof bodyObj.fromUserId === 'string' ? bodyObj.fromUserId.trim() : '';
        const toUserId = typeof bodyObj.toUserId === 'string' ? bodyObj.toUserId.trim() : '';

        if (!fromUserId || !toUserId || fromUserId === toUserId) {
          return { success: true };
        }

        await GenerationModel.updateMany(
          { user_id: fromUserId },
          { user_id: toUserId }
        );
        return { success: true };
      }

      // Default: create new generation record
      const gen = bodyObj as Record<string, unknown>;
      const id = (gen.id as string) || crypto.randomUUID();
      
      await GenerationModel.create({
        id,
        user_id: (gen.userId as string) || 'anonymous',
        project_id: (gen.projectId as string) || 'default',
        output_url: gen.outputUrl as string,
        config: gen.config as Record<string, unknown>,
        status: (gen.status as 'pending' | 'completed' | 'failed') || 'completed',
        created_at: (gen.createdAt as string) || new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to save history:', error);
      throw new HttpError(500, 'Failed to save history');
    }
  }

  public async deleteHistory(ids: string[]): Promise<{ success: true }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true };
    }

    for (const id of ids) {
      if (isValidId(id)) {
        await GenerationModel.deleteOne({ id });
      }
    }

    return { success: true };
  }

  private async cleanupStaleGenerations(): Promise<void> {
    console.log('[HistoryService] Cleanup completed (placeholder)');
  }
}
