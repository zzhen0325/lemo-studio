import { randomUUID } from 'crypto';
import type { StyleStack } from '@/types/database';
import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { StyleStack as StyleStackEntity } from '../db';
import { readJsonAsset } from '../../lib/runtime-assets';
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
        const normalized = await tryNormalizeAssetUrlToCdn(imagePath, { preferredSubdir: 'outputs' });
        return normalized || imagePath;
      }),
    );

    const normalizedCollageImageUrl = style.collageImageUrl
      ? (await tryNormalizeAssetUrlToCdn(style.collageImageUrl, { preferredSubdir: 'outputs' })) || style.collageImageUrl
      : undefined;

    const changed = normalizedCollageImageUrl !== style.collageImageUrl
      || normalizedImagePaths.some((value, index) => value !== rawImagePaths[index]);

    const persistedId = String(styleWithId._id || styleWithId.id || '');
    if (changed && persistedId) {
      await this.styleStackModel.updateOne(
        { _id: persistedId },
        {
          $set: {
            imagePaths: normalizedImagePaths,
            previewUrls: normalizedImagePaths,
            collageImageUrl: normalizedCollageImageUrl,
          },
        },
      );
    }

    return {
      id: persistedId,
      name: style.name,
      prompt: style.prompt,
      imagePaths: normalizedImagePaths,
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

      return Promise.all(styles.map((s) => this.normalizeStyleDocument({
        _id: String(s._id),
        name: s.name,
        prompt: s.prompt,
        imagePaths: (s.imagePaths && s.imagePaths.length > 0 ? s.imagePaths : s.previewUrls || []) as string[],
        previewUrls: s.previewUrls as string[] | undefined,
        collageImageUrl: s.collageImageUrl,
        collageConfig: s.collageConfig,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
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
                updatedAt,
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
          const normalized = await tryNormalizeAssetUrlToCdn(imagePath, { preferredSubdir: 'outputs' });
          return normalized || imagePath;
        }),
      );
      const normalizedCollageImageUrl = styleData.collageImageUrl
        ? (await tryNormalizeAssetUrlToCdn(styleData.collageImageUrl, { preferredSubdir: 'outputs' })) || styleData.collageImageUrl
        : undefined;

      const updatedAt = new Date();
      const doc: Record<string, unknown> = {
        name: styleData.name,
        prompt: styleData.prompt,
        imagePaths: normalizedImagePaths,
        previewUrls: normalizedImagePaths,
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
        imagePaths: normalizedImagePaths,
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
