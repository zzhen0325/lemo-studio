import {
  DatasetCollectionModel,
  DatasetEntryModel,
  type DatasetCollectionDoc,
  type DatasetEntryDoc,
} from '../db/models';

export interface DatasetEntryListOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
}

export type DatasetCollectionRecord = DatasetCollectionDoc;
export type DatasetEntryRecord = DatasetEntryDoc;

export class DatasetRepository {
  public async findCollection(name: string): Promise<DatasetCollectionRecord | null> {
    return DatasetCollectionModel.findOne({ name }).lean();
  }

  public async listCollections(): Promise<DatasetCollectionRecord[]> {
    return DatasetCollectionModel.find().lean();
  }

  public async createCollection(doc: Partial<DatasetCollectionRecord>): Promise<DatasetCollectionRecord> {
    return DatasetCollectionModel.create(doc);
  }

  public async upsertCollection(
    filter: Record<string, unknown>,
    update: Partial<DatasetCollectionRecord>,
    options?: { upsert?: boolean },
  ): Promise<void> {
    await DatasetCollectionModel.updateOne(filter, update, options);
  }

  public async deleteCollection(name: string): Promise<void> {
    await DatasetCollectionModel.deleteOne({ name });
  }

  public async listEntries(
    filter: Record<string, unknown>,
    options: DatasetEntryListOptions = {},
  ): Promise<DatasetEntryRecord[]> {
    let query = DatasetEntryModel.find(filter);
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (typeof options.limit === 'number') {
      query = query.limit(options.limit);
    }
    return query.lean();
  }

  public async findEntry(filter: Record<string, unknown>): Promise<DatasetEntryRecord | null> {
    return DatasetEntryModel.findOne(filter).lean();
  }

  public async createEntry(doc: Partial<DatasetEntryRecord>): Promise<DatasetEntryRecord> {
    return DatasetEntryModel.create(doc);
  }

  public async insertEntries(docs: Array<Partial<DatasetEntryRecord>>): Promise<DatasetEntryRecord[]> {
    return DatasetEntryModel.insertMany(docs);
  }

  public async upsertEntry(
    filter: Record<string, unknown>,
    update: Partial<DatasetEntryRecord>,
    options?: { upsert?: boolean },
  ): Promise<void> {
    await DatasetEntryModel.updateOne(filter, update, options);
  }

  public async updateEntries(filter: Record<string, unknown>, update: Partial<DatasetEntryRecord>): Promise<void> {
    await DatasetEntryModel.updateMany(filter, update);
  }

  public async deleteEntry(filter: Record<string, unknown>): Promise<void> {
    await DatasetEntryModel.deleteOne(filter);
  }

  public async deleteEntries(filter: Record<string, unknown>): Promise<void> {
    await DatasetEntryModel.deleteMany(filter);
  }

  public async countEntries(filter: Record<string, unknown>): Promise<number> {
    return DatasetEntryModel.countDocuments(filter);
  }
}
