import { syncOwnedHistoryImage } from './history-image-sync.repository';
import { getSupabaseClient } from '@/src/storage/database/supabase-client';
import { GenerationModel, type GenerationDoc } from '../db/models';
import { HttpError } from '../utils/http-error';

export interface HistoryListOptions {
  projectId?: string | null;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  select?: string;
}

function buildHistoryFilter(ownerId?: string | null, projectId?: string | null): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (ownerId) {
    filter.user_id = ownerId;
  }

  if (projectId && projectId !== 'null' && projectId !== 'undefined') {
    filter.project_id = projectId;
  }

  return filter;
}

export type GenerationRecord = GenerationDoc;

export class HistoryRepository {
  public async syncImageReference(ownerId: string, localId: string, storageKey: string): Promise<void> {
    await syncOwnedHistoryImage(ownerId, localId, storageKey);
  }

  public async recordGeneratedImage(): Promise<void> {
    const { error } = await getSupabaseClient().rpc('increment_site_stat', { p_key: 'generated_images', p_delta: 1 });
    if (error) throw error;
  }

  public async listByOwner(ownerId: string, options: HistoryListOptions = {}): Promise<GenerationRecord[]> {
    return GenerationModel.findWithPagination(buildHistoryFilter(ownerId, options.projectId), {
      sort: options.sort,
      skip: options.skip,
      limit: options.limit,
      select: options.select,
    });
  }

  public async listPublic(options: HistoryListOptions = {}): Promise<GenerationRecord[]> {
    return GenerationModel.findWithPagination(buildHistoryFilter(undefined, options.projectId), {
      sort: options.sort,
      skip: options.skip,
      limit: options.limit,
      select: options.select,
    });
  }

  public async countByOwner(ownerId: string, projectId?: string | null): Promise<number> {
    return GenerationModel.countDocuments(buildHistoryFilter(ownerId, projectId));
  }

  public async countPublic(projectId?: string | null): Promise<number> {
    const filter = buildHistoryFilter(undefined, projectId);
    if (Object.keys(filter).length === 0) {
      return GenerationModel.estimatedDocumentCount();
    }
    return GenerationModel.countDocuments(filter);
  }

  public async findOwnedById(id: string, ownerId: string): Promise<GenerationRecord | null> {
    return GenerationModel.findOne({ id, user_id: ownerId });
  }

  public async findById(id: string): Promise<GenerationRecord | null> {
    return GenerationModel.findOne({ id });
  }

  public async findOwnedByOutputUrl(outputUrl: string, ownerId: string): Promise<GenerationRecord | null> {
    return GenerationModel.findOne({ output_url: outputUrl, user_id: ownerId });
  }

  public async findByOutputUrl(outputUrl: string): Promise<GenerationRecord | null> {
    return GenerationModel.findOne({ output_url: outputUrl });
  }

  public async updateOwned(id: string, ownerId: string, update: Partial<GenerationRecord>): Promise<void> {
    // Owner changes belong exclusively to the login migration path.
    const changes = { ...update };
    delete changes.id;
    delete changes.user_id;
    const { data, error } = await getSupabaseClient()
      .from('generations')
      .update(changes)
      .eq('id', id)
      .eq('user_id', ownerId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, 'History record is unavailable for this session');
  }

  public async update(id: string, update: Partial<GenerationRecord>): Promise<void> {
    await GenerationModel.updateOne({ id }, update);
  }

  public async upsert(record: Partial<GenerationRecord> & { id: string; user_id: string }): Promise<{ created: boolean }> {
    // Insert first: the primary key arbitrates concurrent creation. Never use an
    // unrestricted upsert, which would let an ID collision replace the owner.
    const { error } = await getSupabaseClient().from('generations').insert(record);
    if (!error) return { created: true };
    if (error.code !== '23505') throw error;

    await this.updateOwned(record.id, record.user_id, record);
    return { created: false };
  }

  public async deleteManyByOwner(ownerId: string, ids: string[]): Promise<void> {
    for (const id of ids) {
      await GenerationModel.deleteOne({ id, user_id: ownerId });
    }
  }

  public async reassignOwner(fromUserId: string, toUserId: string): Promise<number> {
    const migratedCount = await GenerationModel.countDocuments({ user_id: fromUserId });
    if (migratedCount > 0) {
      await GenerationModel.updateMany({ user_id: fromUserId }, { user_id: toUserId });
    }
    return migratedCount;
  }
}
