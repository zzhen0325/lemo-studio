import { randomUUID } from 'crypto';
import type { StyleStack } from '@/types/database';
import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { HttpError } from '../utils/http-error';
import { StyleStack as StyleStackEntity } from '../db';
import { readJsonAsset } from '../../runtime-assets';
import { tryNormalizeAssetUrlToCdn } from '../utils/cdn-image-url';

@Injectable()
export class StylesService {
  @Inject(StyleStackEntity)
  private styleStackModel!: ModelType<StyleStackEntity>;

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
      await this.styleStackModel.updateOne(
        { _id: persistedId },
        {
          $set: {
            imagePaths: validImagePaths,
            previewUrls: validImagePaths,
            collageImageUrl: normalizedCollageImageUrl,
          },
        },
      );
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
      let styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
      if (styles.length === 0) {
        await this.migrateFromCatalog();
        styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
      }

      return Promise.all(styles.map((s: any) => this.normalizeStyleDocument({
        _id: String(s.id || s._id),
        name: s.name,
        prompt: s.prompt,
        imagePaths: (s.imagePaths && s.imagePaths.length > 0 ? s.imagePaths : s.image_paths || s.previewUrls || s.preview_urls || []) as string[],
        previewUrls: (s.previewUrls || s.preview_urls) as string[] | undefined,
        collageImageUrl: s.collageImageUrl || s.collage_image_url,
        collageConfig: s.collageConfig || s.collage_config,
        createdAt: s.createdAt || s.created_at,
        updatedAt: s.updatedAt || s.updated_at,
      })));
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
          await this.styleStackModel.updateOne(
            { _id: id },
            {
              $set: {
                name: style.name || 'Untitled Style',
                prompt: style.prompt || '',
                imagePaths: style.imagePaths || [],
                previewUrls: style.imagePaths || [],
                collageImageUrl: style.collageImageUrl,
                collageConfig: style.collageConfig,
                updatedAt: updatedAt.toISOString(),
              },
            },
            { upsert: true },
          );
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

      await this.styleStackModel.updateOne(
        { _id: styleData.id },
        { $set: doc },
        { upsert: true },
      );

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
      await this.styleStackModel.deleteOne({ _id: id });
    } catch (error) {
      console.error('Failed to delete style', error);
      throw new HttpError(500, 'Failed to delete style');
    }
  }
}
