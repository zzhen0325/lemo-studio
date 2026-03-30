import {
  PresetCategoryModel,
  PresetModel,
  type PresetCategoryDoc,
  type PresetDoc,
} from '../db/models';

export type PresetRecord = PresetDoc;
export type PresetCategoryRecord = PresetCategoryDoc;

export class PresetsRepository {
  public async list(): Promise<PresetRecord[]> {
    return PresetModel.find().sort({ createdAt: -1 }).lean();
  }

  public async upsert(id: string, update: Partial<PresetRecord>): Promise<void> {
    await PresetModel.updateOne({ _id: id }, update, { upsert: true });
  }

  public async save(id: string, update: Partial<PresetRecord>): Promise<PresetRecord | null> {
    return PresetModel.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true });
  }

  public async delete(id: string): Promise<void> {
    await PresetModel.deleteOne({ _id: id });
  }

  public async getCategoriesRecord(key = 'default'): Promise<PresetCategoryRecord | null> {
    return PresetCategoryModel.findOne({ key }).lean();
  }

  public async saveCategories(categories: string[], key = 'default'): Promise<void> {
    await PresetCategoryModel.updateOne({ key }, { categories }, { upsert: true });
  }
}
