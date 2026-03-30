import {
  PlaygroundShortcutModel,
  type PlaygroundShortcutDoc,
} from '../db/models';

export type PlaygroundShortcutRecord = PlaygroundShortcutDoc;

export class PlaygroundShortcutsRepository {
  public async listEnabled(): Promise<PlaygroundShortcutRecord[]> {
    return PlaygroundShortcutModel.findEnabled();
  }

  public async list(filter: Record<string, unknown>): Promise<PlaygroundShortcutRecord[]> {
    return PlaygroundShortcutModel.find(filter).sort({ sort_order: 1 }).lean();
  }

  public async findById(id: string): Promise<PlaygroundShortcutRecord | null> {
    return PlaygroundShortcutModel.findById(id);
  }

  public async findByCode(code: string): Promise<PlaygroundShortcutRecord | null> {
    return PlaygroundShortcutModel.findByCode(code);
  }

  public async create(doc: Partial<PlaygroundShortcutRecord>): Promise<PlaygroundShortcutRecord> {
    return PlaygroundShortcutModel.create(doc);
  }

  public async update(id: string, update: Record<string, unknown>): Promise<void> {
    await PlaygroundShortcutModel.updateOne({ id }, { $set: update });
  }

  public async delete(id: string): Promise<void> {
    await PlaygroundShortcutModel.deleteOne({ id });
  }
}
