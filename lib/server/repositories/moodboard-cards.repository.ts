import {
  MoodboardCardModel,
  type MoodboardCardDoc,
} from '../db/models';

export type MoodboardCardRecord = MoodboardCardDoc;

export class MoodboardCardsRepository {
  public async listEnabled(): Promise<MoodboardCardRecord[]> {
    return MoodboardCardModel.findEnabled();
  }

  public async list(filter: Record<string, unknown>): Promise<MoodboardCardRecord[]> {
    return MoodboardCardModel.find(filter)
      .sort({ sort_order: 1, created_at: 1, name: 1 })
      .lean();
  }

  public async findById(id: string): Promise<MoodboardCardRecord | null> {
    return MoodboardCardModel.findById(id);
  }

  public async findByCode(code: string): Promise<MoodboardCardRecord | null> {
    return MoodboardCardModel.findByCode(code);
  }

  public async create(doc: Partial<MoodboardCardRecord>): Promise<MoodboardCardRecord> {
    return MoodboardCardModel.create(doc);
  }

  public async update(id: string, update: Record<string, unknown>): Promise<void> {
    await MoodboardCardModel.updateOne({ id }, { $set: update });
  }

  public async delete(id: string): Promise<void> {
    await MoodboardCardModel.deleteOne({ id });
  }
}
