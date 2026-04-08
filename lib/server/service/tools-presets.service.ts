import { randomUUID } from 'crypto';
import { ImageAssetsRepository, ToolPresetsRepository } from '../repositories';
import { HttpError } from '../utils/http-error';
import { tryNormalizeAssetUrlToCdn, uploadImageBufferToCdn } from '../utils/cdn-image-url';

export interface ToolPreset {
  id: string;
  name: string;
  values: Record<string, unknown>;
  thumbnail: string;
  timestamp: number;
}

export class ToolsPresetsService {
  constructor(
    private readonly toolPresetsRepository: ToolPresetsRepository,
    private readonly imageAssetsRepository: ImageAssetsRepository,
  ) {}

  private async normalizeThumbnail(id: string, thumbnail?: string) {
    const normalized = await tryNormalizeAssetUrlToCdn(thumbnail, {
      preferredSubdir: 'public/tools-presets',
      preferredFileName: `${id}.png`,
    });

    const displayUrl = normalized.url || thumbnail || '';
    
    if (normalized.storageKey && normalized.storageKey !== thumbnail) {
      await this.toolPresetsRepository.upsert(id, { thumbnail: normalized.storageKey });
    }

    return displayUrl;
  }

  public async listPresets(toolId: string): Promise<ToolPreset[]> {
    try {
      const presets = await this.toolPresetsRepository.listByToolId(toolId);
      return Promise.all(presets.map(async (p) => {
        const presetId = String(p._id || p.id || '');
        return {
          id: presetId,
          name: p.name,
          values: (p.values || {}) as Record<string, unknown>,
          thumbnail: await this.normalizeThumbnail(presetId, p.thumbnail),
          timestamp: p.timestamp || 0,
        };
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
      const screenshotUrl = formData.get('screenshotUrl') as string | null;

      if (!toolId || !name || !valuesStr) {
        throw new HttpError(400, 'Missing required fields');
      }

      const id = randomUUID();
      const timestamp = Date.now();
      const values = JSON.parse(valuesStr);

      let thumbnailPath = '';
      let storageKey = '';
      
      if (screenshotUrl) {
        const result = await tryNormalizeAssetUrlToCdn(screenshotUrl, {
          preferredSubdir: 'public/tools-presets',
          preferredFileName: `${id}.png`,
        });
        thumbnailPath = result.url || screenshotUrl;
        storageKey = result.storageKey || '';
      } else if (screenshot) {
        const buffer = Buffer.from(await screenshot.arrayBuffer());
        const result = await uploadImageBufferToCdn(buffer, {
          preferredSubdir: 'public/tools-presets',
          preferredFileName: `${id}.png`,
          mimeType: 'image/png',
        });
        thumbnailPath = result.url;
        storageKey = result.storageKey;
      }

      const preset: ToolPreset = {
        id,
        name,
        values,
        thumbnail: thumbnailPath,
        timestamp,
      };

      await this.toolPresetsRepository.upsert(id, {
        tool_id: toolId,
        name,
        values,
        thumbnail: storageKey || thumbnailPath,
        timestamp,
      });

      return preset;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Save tool preset error:', error);
      throw new HttpError(500, 'Failed to save preset');
    }
  }

  public async deletePreset(toolId: string, id: string): Promise<void> {
    try {
      await this.toolPresetsRepository.deleteOwned(toolId, id);
      // Note: image_assets cleanup is not needed as preset thumbnails are stored directly in tool_presets table
    } catch (error) {
      console.error('Failed to delete preset', error);
      throw new HttpError(500, 'Failed to delete preset');
    }
  }
}
