import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { ToolPreset as ToolPresetEntity, ImageAsset } from '../db';
import { uploadBufferToCdn } from '../utils/cdn';

export interface ToolPreset {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any;
  thumbnail: string;
  timestamp: number;
}

@Injectable()
export class ToolsPresetsService {
  @Inject(ToolPresetEntity)
  private toolPresetModel!: ModelType<ToolPresetEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async listPresets(toolId: string): Promise<ToolPreset[]> {
    try {
      const presets = await this.toolPresetModel.find({ toolId }).sort({ timestamp: -1 }).lean();
      return presets.map((p) => ({
        id: String(p._id),
        name: p.name,
        values: p.values,
        thumbnail: p.thumbnail || '',
        timestamp: p.timestamp || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch tool presets', error);
      throw new HttpError(500, 'Failed to fetch presets');
    }
  }

  public async savePresetFromFormData(formData: FormData): Promise<ToolPreset> {
    try {
      const toolId = formData.get('toolId') as string | null;
      const name = formData.get('name') as string | null;
      const valuesStr = formData.get('values') as string | null;
      const screenshot = formData.get('screenshot') as unknown as { arrayBuffer: () => Promise<ArrayBuffer> } | null;

      if (!toolId || !name || !valuesStr) {
        throw new HttpError(400, 'Missing required fields');
      }

      const id = randomUUID();
      const timestamp = Date.now();
      const values = JSON.parse(valuesStr);

      let thumbnailPath = '';
      if (screenshot) {
        const buffer = Buffer.from(await screenshot.arrayBuffer());
        const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
        thumbnailPath = dataUrl;
      }

      const preset: ToolPreset = {
        id,
        name,
        values,
        thumbnail: thumbnailPath,
        timestamp,
      };

      await this.toolPresetModel.updateOne(
        { _id: id },
        { toolId, name, values, thumbnail: thumbnailPath, timestamp },
        { upsert: true },
      );

      return preset;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Save tool preset error:', error);
      throw new HttpError(500, 'Failed to save preset');
    }
  }

  public async deletePreset(toolId: string, id: string): Promise<void> {
    try {
      await this.toolPresetModel.deleteOne({ _id: id, toolId });
      await this.imageAssetModel.deleteMany({ 'meta.presetId': id, 'meta.toolId': toolId });
    } catch (error) {
      console.error('Failed to delete preset', error);
      throw new HttpError(500, 'Failed to delete preset');
    }
  }
}
