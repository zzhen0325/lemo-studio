import { GenerationModel, type GenerationDoc } from '../db/models';

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

  public async updateOwned(id: string, ownerId: string, update: Partial<GenerationRecord>): Promise<void> {
    await GenerationModel.updateOne({ id, user_id: ownerId }, update);
  }

  public async update(id: string, update: Partial<GenerationRecord>): Promise<void> {
    await GenerationModel.updateOne({ id }, update);
  }

  public async upsert(record: Partial<GenerationRecord> & { id: string; user_id: string }): Promise<void> {
    const existing = await GenerationModel.findOne({ id: record.id, user_id: record.user_id });
    if (existing) {
      await GenerationModel.updateOne({ id: record.id, user_id: record.user_id }, record);
      return;
    }

    await GenerationModel.create(record);
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
