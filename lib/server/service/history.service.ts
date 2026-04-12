import { HttpError } from '../utils/http-error';
import { HistoryRepository, type GenerationRecord } from '../repositories';
import type { Generation } from '../../../types/database';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';
import { getFileUrl } from '@/src/storage/object-storage';
import { getBatchInteractionData } from './interaction.service';

export type SortBy = 'recent' | 'likes' | 'favorites' | 'downloads' | 'edits' | 'interactionPriority';

/**
 * Check if a string is a storage key (not a full URL)
 * Storage keys look like: ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/outputs/img.png
 */
function isStorageKey(value: string): boolean {
  // Storage keys don't have protocol prefix
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return false;
  }
  // Storage keys have path separators
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
 * Get presigned URL for a value that might be a storage key or URL
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

export interface HistoryQuery {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
  sortBy?: SortBy | null;
  viewerUserId?: string | null;
  lightweight?: string | number | boolean | null;
  minimal?: string | number | boolean | null;
}

// Simple UUID validation
function isValidId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isEnabledFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

export class HistoryService {
  constructor(private readonly historyRepository: HistoryRepository) {}

  /**
   * Normalize URLs for storage and display
   * - Converts local paths and data URLs to storage keys
   * - Extracts storage keys from presigned URLs
   * - Stores storage keys in database (permanent)
   * - Returns presigned URLs for display (temporary)
   */
  private async normalizeGenerationUrls(
    itemId: string,
    outputUrl?: string,
    sourceImageUrls: string[] = [],
    existingConfig: Record<string, unknown> = {},
  ) {
    // Process output URL
    let outputStorageKey: string | undefined;
    let outputDisplayUrl: string | undefined;
    
    if (outputUrl) {
      const normalized = await tryNormalizeAssetUrlToCdn(outputUrl, { preferredSubdir: 'outputs' });
      if (normalized.storageKey) {
        outputStorageKey = normalized.storageKey;
        outputDisplayUrl = await getDisplayUrl(normalized.storageKey);
      } else if (normalized.url) {
        // Fallback to URL if no storage key
        outputDisplayUrl = normalized.url;
        outputStorageKey = normalized.url;
      } else {
        // Keep original if normalization failed
        outputStorageKey = outputUrl;
        outputDisplayUrl = await getDisplayUrl(outputUrl);
      }
    }
    
    // Process source image URLs
    const sourceResults = await Promise.all(
      sourceImageUrls.map(async (sourceImageUrl) => {
        const normalized = await tryNormalizeAssetUrlToCdn(sourceImageUrl, { preferredSubdir: 'upload' });
        if (normalized.storageKey) {
          return {
            storageKey: normalized.storageKey,
            displayUrl: await getDisplayUrl(normalized.storageKey),
          };
        }
        if (normalized.url) {
          return { storageKey: normalized.url, displayUrl: normalized.url };
        }
        const displayUrl = await getDisplayUrl(sourceImageUrl);
        return { storageKey: sourceImageUrl, displayUrl };
      }),
    );
    
    const sourceStorageKeys = sourceResults.map(r => r.storageKey);
    const sourceDisplayUrls = sourceResults.map(r => r.displayUrl);

    // Check if we need to update the database with storage keys
    const needsUpdate = 
      (outputStorageKey && outputStorageKey !== outputUrl) ||
      sourceStorageKeys.some((key, index) => key !== sourceImageUrls[index]);

    if (itemId && needsUpdate) {
      const updatePayload: Partial<GenerationRecord> = {};
      if (outputStorageKey && outputStorageKey !== outputUrl) {
        updatePayload.output_url = outputStorageKey;
      }
      if (sourceStorageKeys.some((key, index) => key !== sourceImageUrls[index])) {
        updatePayload.config = {
          ...existingConfig,
          sourceImageUrls: sourceStorageKeys,
        };
      }
      if (Object.keys(updatePayload).length > 0) {
        await this.historyRepository.update(itemId, updatePayload);
      }
    }

    return {
      outputUrl: outputDisplayUrl,
      sourceImageUrls: sourceDisplayUrls,
    };
  }

  public async getHistory(query: HistoryQuery): Promise<{ history: Generation[]; total: number; hasMore: boolean }> {
    const { page, limit, projectId, userId, sortBy, viewerUserId, lightweight, minimal } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const lightweightMode = isEnabledFlag(lightweight);
    const minimalMode = isEnabledFlag(minimal);
    const shouldUseLightweightMapping = lightweightMode || minimalMode;
    const debugHistory = process.env.DEBUG_HISTORY === 'true' || process.env.HISTORY_DEBUG === '1';

    // Auto cleanup old records with 1% probability
    if (Math.random() < 0.01) {
      this.cleanupStaleGenerations().catch(err => console.error('Background cleanup failed:', err));
    }

    try {
      const hasOwnerFilter = Boolean(userId);

      if (debugHistory) {
        console.info('[HistoryDebug][Server] query', {
          page: pageNum,
          limit: limitNum,
          projectId: projectId || null,
          userId: userId || null,
          sortBy: sortBy || 'recent',
          viewerUserId: viewerUserId || null,
          filter: {
            user_id: userId || null,
            project_id: projectId || null,
          },
        });
      }

      // Determine sort order based on sortBy parameter
      let sortOption: Record<string, 1 | -1>;
      switch (sortBy) {
        case 'likes':
          sortOption = { like_count: -1, last_liked_at: -1, created_at: -1 };
          break;
        case 'favorites':
          sortOption = { moodboard_add_count: -1, last_moodboard_added_at: -1, created_at: -1 };
          break;
        case 'downloads':
          sortOption = { download_count: -1, last_downloaded_at: -1, created_at: -1 };
          break;
        case 'edits':
          sortOption = { edit_count: -1, last_edited_at: -1, created_at: -1 };
          break;
        case 'interactionPriority':
          sortOption = { 
            like_count: -1, 
            last_liked_at: -1,
            moodboard_add_count: -1, 
            last_moodboard_added_at: -1,
            download_count: -1, 
            last_downloaded_at: -1,
            edit_count: -1, 
            last_edited_at: -1,
            created_at: -1 
          };
          break;
        case 'recent':
        default:
          sortOption = { created_at: -1 };
          break;
      }

      // Get total count
      const total = hasOwnerFilter
        ? await this.historyRepository.countByOwner(userId!, projectId)
        : await this.historyRepository.countPublic(projectId);

      // Get items with pagination
      const listOptions = {
        projectId,
        sort: sortOption,
        skip: (pageNum - 1) * limitNum,
        limit: limitNum,
        select: shouldUseLightweightMapping
          ? 'id,user_id,project_id,output_url,config,status,created_at,progress,progress_stage'
          : 'id,user_id,project_id,output_url,config,status,created_at,progress,progress_stage,like_count,moodboard_add_count,download_count,edit_count,last_liked_at,last_moodboard_added_at,last_downloaded_at,last_edited_at',
      };
      const items = hasOwnerFilter
        ? await this.historyRepository.listByOwner(userId!, listOptions)
        : await this.historyRepository.listPublic(listOptions);

      if (debugHistory) {
        const sampleUserIds = items.slice(0, 5).map((item) => item.user_id || null);
        console.info('[HistoryDebug][Server] db_result', {
          total,
          fetched: items.length,
          hasMore: (pageNum - 1) * limitNum + items.length < total,
          sampleUserIds,
        });
      }

      // Batch get interaction data if viewerUserId is provided
      const itemIds = items.map(item => item.id);
      const interactionDataMap = viewerUserId 
        && !shouldUseLightweightMapping
        ? await getBatchInteractionData(itemIds, viewerUserId)
        : new Map();

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

        // Get interaction data
        const interactionData = interactionDataMap.get(item.id);
        const normalizedUrls = shouldUseLightweightMapping
          ? {
            outputUrl,
            sourceImageUrls,
          }
          : await this.normalizeGenerationUrls(
            item.id,
            outputUrl,
            sourceImageUrls,
            config,
          );

        return {
          id: item.id,
          userId: item.user_id || 'anonymous',
          projectId: item.project_id || 'default',
          outputUrl: normalizedUrls.outputUrl,
          config: {
            ...config,
            ...(shouldUseLightweightMapping ? { __minimal: true } : {}),
            sourceImageUrls: normalizedUrls.sourceImageUrls,
            localSourceIds,
          },
          status: item.status || 'completed',
          createdAt: item.created_at || new Date().toISOString(),
          progress: item.progress,
          progressStage: item.progress_stage,
          interactionStats: shouldUseLightweightMapping
            ? undefined
            : (interactionData?.interactionStats || {
              likeCount: item.like_count || 0,
              moodboardAddCount: item.moodboard_add_count || 0,
              downloadCount: item.download_count || 0,
              editCount: item.edit_count || 0,
              lastLikedAt: item.last_liked_at || undefined,
              lastMoodboardAddedAt: item.last_moodboard_added_at || undefined,
              lastDownloadedAt: item.last_downloaded_at || undefined,
              lastEditedAt: item.last_edited_at || undefined,
            }),
          viewerState: shouldUseLightweightMapping ? undefined : interactionData?.viewerState,
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

  public async reassignHistoryOwner(fromUserId: string, toUserId: string): Promise<{ success: true; migratedCount: number }> {
    const from = fromUserId.trim();
    const to = toUserId.trim();

    if (!from || !to || from === to) {
      return { success: true, migratedCount: 0 };
    }

    const migratedCount = await this.historyRepository.reassignOwner(from, to);
    return { success: true, migratedCount };
  }

  public async saveHistory(body: unknown, actorId: string): Promise<{ success: true; migratedCount?: number }> {
    try {
      const bodyObj = body as Record<string, unknown>;
      
      if (bodyObj.action === 'batch-update' && Array.isArray(bodyObj.items)) {
        const items = bodyObj.items as Generation[];
        for (const item of items) {
          if (!item.id || !isValidId(item.id)) continue;
          const existing = await this.historyRepository.findOwnedById(item.id, actorId);
          if (!existing) continue;

          await this.historyRepository.updateOwned(item.id, actorId, {
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
        return { success: true, migratedCount: 0 };
      }

      // Default: create new generation record
      const gen = bodyObj as Record<string, unknown>;
      const id = (gen.id as string) || crypto.randomUUID();

      const nextDoc = {
        id,
        user_id: actorId,
        project_id: (gen.projectId as string) || 'default',
        output_url: gen.outputUrl as string,
        config: gen.config as Record<string, unknown>,
        status: (gen.status as 'pending' | 'completed' | 'failed') || 'completed',
        created_at: (gen.createdAt as string) || new Date().toISOString(),
      };

      await this.historyRepository.upsert(nextDoc);

      return { success: true };
    } catch (error) {
      console.error('Failed to save history:', error);
      throw new HttpError(500, 'Failed to save history');
    }
  }

  public async deleteHistory(ids: string[], actorId: string): Promise<{ success: true }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true };
    }

    await this.historyRepository.deleteManyByOwner(actorId, ids.filter(isValidId));

    return { success: true };
  }

  private async cleanupStaleGenerations(): Promise<void> {
    console.log('[HistoryService] Cleanup completed (placeholder)');
  }
}
