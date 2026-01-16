import { randomUUID } from 'crypto';
import type { Preset } from '@/types/database';
import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Preset as PresetEntity, ImageAsset } from '../db';
import { uploadBufferToCdn } from '../utils/cdn';

@Injectable()
export class PresetsService {
  @Inject(PresetEntity)
  private presetModel!: ModelType<PresetEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async listPresets(): Promise<Preset[]> {
    try {
      const presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();
      return presets.map((p) => ({
        id: String(p._id),
        name: p.name,
        coverUrl: p.coverUrl || '',
        config: (p.config || {}) as Preset['config'],
        editConfig: (p.editConfig || {}) as Preset['editConfig'],
        category: p.category,
        projectId: p.projectId,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        type: p.type,
      }));
    } catch (error) {
      console.error('Failed to fetch presets', error);
      throw new HttpError(500, 'Failed to fetch presets');
    }
  }

  public async savePresetFromFormData(formData: FormData): Promise<Preset> {
    try {
      const jsonStr = formData.get('json') as string | null;
      const coverFile = formData.get('cover') as unknown as { size?: number; type?: string; arrayBuffer: () => Promise<ArrayBuffer> } | null;

      if (!jsonStr) {
        throw new HttpError(400, 'Missing json data');
      }

      const presetData = JSON.parse(jsonStr) as Preset;

      if (!presetData.id) {
        presetData.id = randomUUID();
      }
      const id = presetData.id;

      if (coverFile && coverFile.size && coverFile.size > 0) {
        const arrayBuffer = await coverFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let ext = 'png';
        if (coverFile.type === 'image/jpeg') ext = 'jpg';
        else if (coverFile.type === 'image/webp') ext = 'webp';

        const fileName = `${id}.${ext}`;
        const cdn = await uploadBufferToCdn(buffer, {
          fileName,
          dir: 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/preset',
          region: 'SG',
        });
        presetData.coverUrl = cdn.url;

        await this.imageAssetModel.create({
          url: cdn.url,
          dir: cdn.dir,
          fileName: cdn.fileName,
          region: 'SG',
          type: 'upload',
          meta: { presetId: id },
        });
      }

      await this.presetModel.updateOne(
        { _id: presetData.id },
        {
          name: presetData.name,
          coverUrl: presetData.coverUrl,
          config: presetData.config,
          editConfig: presetData.editConfig,
          category: presetData.category,
          projectId: presetData.projectId,
          type: presetData.type,
          createdAt: presetData.createdAt || new Date().toISOString(),
        },
        { upsert: true },
      );

      return presetData;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Save preset error:', error);
      throw new HttpError(500, 'Failed to save preset');
    }
  }

  public async deletePreset(id: string): Promise<void> {
    try {
      await this.presetModel.deleteOne({ _id: id });
      await this.imageAssetModel.deleteMany({ 'meta.presetId': id });
    } catch (error) {
      console.error('Failed to delete preset', error);
      throw new HttpError(500, 'Failed to delete preset');
    }
  }
}
