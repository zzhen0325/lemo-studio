import { HttpError } from '../utils/http-error';
import type { HistoryRepository } from '../repositories/history.repository';
import type { Generation } from '@/types/database';

// Simple UUID validation
export function isValidId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function saveHistoryRecord(historyRepository: HistoryRepository, body: unknown, actorId: string): Promise<{ success: true; migratedCount?: number }> {
    try {
      const bodyObj = body as Record<string, unknown>;
      
      if (bodyObj.action === 'batch-update' && Array.isArray(bodyObj.items)) {
        const items = bodyObj.items as Generation[];
        for (const item of items) {
          if (!item.id || !isValidId(item.id)) continue;
          const existing = await historyRepository.findOwnedById(item.id, actorId);
          if (!existing) continue;

          await historyRepository.updateOwned(item.id, actorId, {
            output_url: item.outputUrl,
            config: item.config as Record<string, unknown>,
            status: item.status,
          });
        }
        return { success: true };
      }

      if (bodyObj.action === 'sync-image') {
        if (typeof bodyObj.localId !== 'string' || !bodyObj.localId.trim()
          || typeof bodyObj.path !== 'string' || !bodyObj.path.trim()) {
          throw new HttpError(400, 'localId and path are required for image synchronization');
        }
        await historyRepository.syncImageReference(actorId, bodyObj.localId, bodyObj.path);
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

      const { created } = await historyRepository.upsert(nextDoc);

      if (created && nextDoc.output_url) {
        void historyRepository.recordGeneratedImage().catch(() => {});
      }

      return { success: true };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to save history:', error);
      throw new HttpError(500, 'Failed to save history');
    }
}
