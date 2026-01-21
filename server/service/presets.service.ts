import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Preset } from '@/types/database';
import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Preset as PresetEntity, ImageAsset } from '../db';

const PRESET_DIR = path.join(process.cwd(), 'public/preset');

@Injectable()
export class PresetsService {
  @Inject(PresetEntity)
  private presetModel!: ModelType<PresetEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async listPresets(): Promise<Preset[]> {
    try {
      let presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();

      // Migration check: if DB is empty, try to import from local files
      if (presets.length === 0) {
        await this.migrateFromFiles();
        presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();
      }

      return presets.map((p) => ({
        id: String(p._id),
        name: p.name,
        coverUrl: p.coverUrl || '',
        config: (p.config || {}) as Preset['config'],
        editConfig: p.editConfig as Preset['editConfig'],
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

  private async migrateFromFiles() {
    try {
      await fs.access(PRESET_DIR);
      const files = await fs.readdir(PRESET_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'categories.json');

      console.log(`Starting migration of ${jsonFiles.length} presets from files...`);

      for (const file of jsonFiles) {
        try {
          const id = path.basename(file, '.json');
          const content = await fs.readFile(path.join(PRESET_DIR, file), 'utf-8');
          const presetData = JSON.parse(content) as Preset;

          // Try to find matching image
          const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
          let dataUrl = presetData.coverUrl;

          for (const ext of imageExtensions) {
            const imagePath = path.join(PRESET_DIR, `${id}${ext}`);
            try {
              await fs.access(imagePath);
              const buffer = await fs.readFile(imagePath);
              const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
              break;
            } catch { /* ignore */ }
          }

          await this.presetModel.updateOne(
            { _id: id },
            {
              name: presetData.name,
              coverUrl: dataUrl,
              coverData: dataUrl?.startsWith('data:') ? dataUrl : undefined,
              config: presetData.config,
              editConfig: presetData.editConfig,
              category: presetData.category,
              projectId: presetData.projectId,
              type: presetData.type,
              createdAt: presetData.createdAt || new Date().toISOString(),
            },
            { upsert: true }
          );
        } catch (e) {
          console.error(`Failed to migrate preset ${file}`, e);
        }
      }
    } catch {
      // Directory doesn't exist or other error, skip migration
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
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${coverFile.type || 'image/png'};base64,${base64}`;
        
        presetData.coverUrl = dataUrl;
      }

      // 如果客户端直接传了 URL (比如已经是 CDN 地址)，但不是 DataURL，也不是 local:
      // 则直接保存
      const formDataCoverUrl = formData.get('coverUrl') as string | null;
      if (formDataCoverUrl && !formDataCoverUrl.startsWith('local:') && !formDataCoverUrl.startsWith('data:')) {
          presetData.coverUrl = formDataCoverUrl;
      }

      await this.presetModel.findOneAndUpdate(
        { _id: presetData.id },
        {
          name: presetData.name,
          coverUrl: presetData.coverUrl,
          coverData: presetData.coverUrl?.startsWith('data:') ? presetData.coverUrl : undefined,
          config: presetData.config,
          editConfig: presetData.editConfig,
          category: presetData.category,
          projectId: presetData.projectId,
          type: presetData.type,
          createdAt: presetData.createdAt || new Date().toISOString(),
        },
        { upsert: true, new: true },
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
