import { StyleStackModel, type StyleStackDoc } from '../db/models';

export type StyleStackRecord = StyleStackDoc;

export class StylesRepository {
  public async list(): Promise<StyleStackRecord[]> {
    return StyleStackModel.find().sort({ updatedAt: -1 }).lean();
  }

  public async upsert(id: string, update: Partial<StyleStackRecord>): Promise<void> {
    await StyleStackModel.updateOne({ _id: id }, { $set: update }, { upsert: true });
  }

  public async delete(id: string): Promise<void> {
    await StyleStackModel.deleteOne({ _id: id });
  }
}
