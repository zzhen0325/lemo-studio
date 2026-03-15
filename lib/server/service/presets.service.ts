import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Preset } from '@/types/database';
import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { HttpError } from '../utils/http-error';
import { Preset as PresetEntity, ImageAsset } from '../db';
import { readJsonAsset } from '../../runtime-assets';
import { tryNormalizeAssetUrlToCdn, uploadImageBufferToCdn } from '../utils/cdn-image-url';

const PRESET_DIR = path.join(process.cwd(), 'public/preset');

@Injectable()
export class PresetsService {
  @Inject(PresetEntity)
  private presetModel!: ModelType<PresetEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  private async normalizeStoredPresetCover(id: string, coverUrl?: string, coverData?: string) {
    const normalized = await tryNormalizeAssetUrlToCdn(coverUrl || coverData, {
      preferredSubdir: 'public/preset',
      preferredFileName: `${id}.png`,
    });

    if (normalized && normalized !== coverUrl) {
      await this.presetModel.updateOne(
        { _id: id },
        { $set: { coverUrl: normalized, coverData: undefined } },
      );
      return normalized;
    }

    return normalized || coverUrl || '';
  }

  public async listPresets(): Promise<Preset[]> {
    try {
      let presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();

      // Migration check: if DB is empty, try to import from local files
      if (presets.length === 0) {
        await this.migrateFromFiles();
        presets = await this.presetModel.find().sort({ createdAt: -1 }).lean();
      }

      return Promise.all(presets.map(async (p) => ({
        id: String(p._id),
        name: p.name,
        coverUrl: await this.normalizeStoredPresetCover(String(p._id), p.coverUrl, p.coverData),
        config: (p.config || {}) as unknown as Preset['config'],
        editConfig: (p.editConfig as unknown as Preset['editConfig']) || undefined,
        category: p.category,
        projectId: p.projectId,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        type: p.type,
      })));
    } catch (error) {
      console.error('Failed to fetch presets', error);
      throw new HttpError(500, 'Failed to fetch presets');
    }
  }

  private async migrateFromFiles() {
    const migratedFromCatalog = await this.migrateFromCatalog();
    if (migratedFromCatalog) {
      return;
    }

    try {
      await fs.access(PRESET_DIR);
      const files = await fs.readdir(PRESET_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'categories.json');

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

          await this.upsertPreset(id, presetData, dataUrl);
        } catch (e) {
          console.error(`Failed to migrate preset ${file}`, e);
        }
      }
    } catch {
      // Directory doesn't exist or other error, skip migration
    }
  }

  private async migrateFromCatalog(): Promise<boolean> {
    try {
      const catalog = await readJsonAsset<Preset[]>('config/preset-catalog.json');
      if (!Array.isArray(catalog) || catalog.length === 0) {
        return false;
      }

      await Promise.all(
        catalog.map(async (preset) => {
          const id = preset.id || randomUUID();
          await this.upsertPreset(id, preset, preset.coverUrl);
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  private async upsertPreset(id: string, presetData: Preset, coverUrl?: string) {
    const normalizedCoverUrl = coverUrl
      ? await tryNormalizeAssetUrlToCdn(coverUrl, {
        preferredSubdir: 'public/preset',
        preferredFileName: `${id}.png`,
      })
      : undefined;

    await this.presetModel.updateOne(
      { _id: id },
      {
        name: presetData.name,
        coverUrl: normalizedCoverUrl || coverUrl,
        coverData: undefined,
        config: presetData.config,
        editConfig: presetData.editConfig,
        category: presetData.category,
        projectId: presetData.projectId,
        type: presetData.type,
        createdAt: presetData.createdAt || new Date().toISOString(),
      },
      { upsert: true }
    );
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

      if (coverFile && coverFile.size && coverFile.size > 0) {
        const arrayBuffer = await coverFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        presetData.coverUrl = await uploadImageBufferToCdn(buffer, {
          preferredSubdir: 'public/preset',
          preferredFileName: `${presetData.id}.${(coverFile.type || 'image/png').includes('jpeg') ? 'jpg' : 'png'}`,
          mimeType: coverFile.type || 'image/png',
        });
      }

      // 如果客户端直接传了 URL (比如已经是 CDN 地址)，但不是 DataURL，也不是 local:
      // 则直接保存
      const formDataCoverUrl = formData.get('coverUrl') as string | null;
      if (formDataCoverUrl && !formDataCoverUrl.startsWith('local:') && !formDataCoverUrl.startsWith('data:')) {
        presetData.coverUrl = formDataCoverUrl;
      }

      const normalizedCoverUrl = presetData.coverUrl
        ? await tryNormalizeAssetUrlToCdn(presetData.coverUrl, {
          preferredSubdir: 'public/preset',
          preferredFileName: `${presetData.id}.png`,
        })
        : undefined;
      if (normalizedCoverUrl) {
        presetData.coverUrl = normalizedCoverUrl;
      }

      await this.presetModel.findOneAndUpdate(
        { _id: presetData.id },
        {
          name: presetData.name,
          coverUrl: presetData.coverUrl,
          coverData: undefined,
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
