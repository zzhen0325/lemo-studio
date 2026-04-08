import { ToolPresetModel, type ToolPresetDoc } from '../db/models';

export type ToolPresetRecord = ToolPresetDoc;

export class ToolPresetsRepository {
  public async listByToolId(toolId: string): Promise<ToolPresetRecord[]> {
    return ToolPresetModel.find({ tool_id: toolId }).sort({ timestamp: -1 }).lean();
  }

  public async upsert(id: string, update: Partial<ToolPresetRecord>): Promise<void> {
    await ToolPresetModel.updateOne({ _id: id }, update, { upsert: true });
  }

  public async deleteOwned(toolId: string, id: string): Promise<void> {
    await ToolPresetModel.deleteOne({ _id: id, tool_id: toolId });
  }
}
