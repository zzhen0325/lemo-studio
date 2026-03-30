import { randomUUID } from 'crypto';
import type { StyleStack } from '@/types/database';
import { StylesRepository } from '../repositories';
import { HttpError } from '../utils/http-error';
import { readJsonAsset } from '../../runtime-assets';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';

export class StylesService {
  constructor(private readonly stylesRepository: StylesRepository) {}

  private async normalizeStyleDocument(style: {
    _id?: string;
    id?: string;
    name: string;
    prompt: string;
    imagePaths?: string[];
    previewUrls?: string[];
    collageImageUrl?: string;
    collageConfig?: Record<string, unknown>;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }) {
    const styleWithId = style;
    const rawImagePaths = Array.isArray(style.imagePaths) ? style.imagePaths : [];
    const normalizedImagePaths = await Promise.all(
      rawImagePaths.map(async (imagePath) => {
        // 确保 imagePath 是字符串
        if (typeof imagePath !== 'string') {
          console.warn('[StylesService] Non-string imagePath found:', imagePath);
          return '';
        }
        const normalized = await tryNormalizeAssetUrlToCdn(imagePath, { preferredSubdir: 'outputs' });
        // 优先使用 url，如果没有则使用原始值
        return normalized.url || imagePath;
      }),
    );

    // 过滤掉空值
    const validImagePaths = normalizedImagePaths.filter(Boolean);

    let normalizedCollageImageUrl: string | undefined;
    if (style.collageImageUrl && typeof style.collageImageUrl === 'string') {
      const result = await tryNormalizeAssetUrlToCdn(style.collageImageUrl, { preferredSubdir: 'outputs' });
      normalizedCollageImageUrl = result.url || style.collageImageUrl;
    }

    const changed = normalizedCollageImageUrl !== style.collageImageUrl
      || validImagePaths.some((value, index) => value !== rawImagePaths[index]);

    const persistedId = String(styleWithId._id || styleWithId.id || '');
    if (changed && persistedId) {
      await this.stylesRepository.upsert(persistedId, {
        imagePaths: validImagePaths,
        previewUrls: validImagePaths,
        collageImageUrl: normalizedCollageImageUrl,
      });
    }

    return {
      id: persistedId,
      name: style.name,
      prompt: style.prompt,
      imagePaths: validImagePaths,
      collageImageUrl: normalizedCollageImageUrl,
      collageConfig: style.collageConfig,
      updatedAt: new Date(styleWithId.updatedAt || styleWithId.createdAt || Date.now()).toISOString(),
    } as StyleStack;
  }

  public async listStyles(): Promise<StyleStack[]> {
    try {
      let styles = await this.stylesRepository.list();
      if (styles.length === 0) {
        await this.migrateFromCatalog();
        styles = await this.stylesRepository.list();
      }

      return Promise.all(styles.map((styleRecord) => {
        const normalizedRecord = styleRecord as unknown as Record<string, unknown>;
        return this.normalizeStyleDocument({
          _id: String(normalizedRecord.id || normalizedRecord._id || ''),
          name: String(normalizedRecord.name || ''),
          prompt: String(normalizedRecord.prompt || ''),
          imagePaths: (normalizedRecord.imagePaths && Array.isArray(normalizedRecord.imagePaths) && normalizedRecord.imagePaths.length > 0
            ? normalizedRecord.imagePaths
            : normalizedRecord.image_paths || normalizedRecord.previewUrls || normalizedRecord.preview_urls || []) as string[],
          previewUrls: (normalizedRecord.previewUrls || normalizedRecord.preview_urls) as string[] | undefined,
          collageImageUrl: (normalizedRecord.collageImageUrl || normalizedRecord.collage_image_url) as string | undefined,
          collageConfig: (normalizedRecord.collageConfig || normalizedRecord.collage_config) as Record<string, unknown> | undefined,
          createdAt: (normalizedRecord.createdAt || normalizedRecord.created_at) as string | Date | undefined,
          updatedAt: (normalizedRecord.updatedAt || normalizedRecord.updated_at) as string | Date | undefined,
        });
      }));
    } catch (error) {
      console.error('Failed to fetch styles', error);
      throw new HttpError(500, 'Failed to fetch styles');
    }
  }

  private async migrateFromCatalog(): Promise<void> {
    try {
      const catalog = await readJsonAsset<StyleStack[]>('config/style-catalog.json');
      if (!Array.isArray(catalog) || catalog.length === 0) {
        return;
      }

      await Promise.all(
        catalog.map(async (style) => {
          const id = style.id || randomUUID();
          const updatedAt = style.updatedAt ? new Date(style.updatedAt) : new Date();
          await this.stylesRepository.upsert(id, {
            name: style.name || 'Untitled Style',
            prompt: style.prompt || '',
            imagePaths: style.imagePaths || [],
            previewUrls: style.imagePaths || [],
            collageImageUrl: style.collageImageUrl,
            collageConfig: style.collageConfig,
            updatedAt: updatedAt.toISOString(),
          });
        }),
      );
    } catch (error) {
      console.warn('[StylesService] Failed to migrate styles from CDN catalog:', error);
    }
  }

  public async saveStyle(styleData: StyleStack): Promise<StyleStack> {
    try {
      if (!styleData.id) {
        styleData.id = randomUUID();
      }

      const normalizedImagePaths = await Promise.all(
        (styleData.imagePaths || []).map(async (imagePath) => {
          if (typeof imagePath !== 'string') {
            console.warn('[StylesService] Non-string imagePath found:', imagePath);
            return '';
          }
          const normalized = await tryNormalizeAssetUrlToCdn(imagePath, { preferredSubdir: 'outputs' });
          return normalized.url || imagePath;
        }),
      );
      
      const validImagePaths = normalizedImagePaths.filter(Boolean);
      
      let normalizedCollageImageUrl: string | undefined;
      if (styleData.collageImageUrl && typeof styleData.collageImageUrl === 'string') {
        const result = await tryNormalizeAssetUrlToCdn(styleData.collageImageUrl, { preferredSubdir: 'outputs' });
        normalizedCollageImageUrl = result.url || styleData.collageImageUrl;
      }

      const updatedAt = new Date();
      const doc: Record<string, unknown> = {
        name: styleData.name,
        prompt: styleData.prompt,
        imagePaths: validImagePaths,
        previewUrls: validImagePaths,
        updatedAt,
      };

      if (normalizedCollageImageUrl !== undefined) {
        doc.collageImageUrl = normalizedCollageImageUrl;
      }
      if (styleData.collageConfig !== undefined) {
        doc.collageConfig = styleData.collageConfig;
      }

      await this.stylesRepository.upsert(styleData.id, doc);

      return {
        ...styleData,
        id: styleData.id,
        imagePaths: validImagePaths,
        collageImageUrl: normalizedCollageImageUrl,
        updatedAt: updatedAt.toISOString(),
      };
    } catch (error) {
      console.error('Save style error:', error);
      throw new HttpError(500, 'Failed to save style');
    }
  }

  public async deleteStyle(id: string): Promise<void> {
    try {
      await this.stylesRepository.delete(id);
    } catch (error) {
      console.error('Failed to delete style', error);
      throw new HttpError(500, 'Failed to delete style');
    }
  }
}
