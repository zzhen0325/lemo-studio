import { randomUUID } from 'crypto';
import type { StyleStack } from '@/types/database';
import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { StyleStack as StyleStackEntity } from '../db';
import { readJsonAsset } from '../../lib/runtime-assets';

@Injectable()
export class StylesService {
  @Inject(StyleStackEntity)
  private styleStackModel!: ModelType<StyleStackEntity>;

  public async listStyles(): Promise<StyleStack[]> {
    try {
      let styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
      if (styles.length === 0) {
        await this.migrateFromCatalog();
        styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
      }

      return styles.map((s) => ({
        id: String(s._id),
        name: s.name,
        prompt: s.prompt,
        imagePaths:
          (s.imagePaths && s.imagePaths.length > 0
            ? s.imagePaths
            : s.previewUrls || []) as string[],
        collageImageUrl: s.collageImageUrl,
        collageConfig: s.collageConfig,
        updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()).toISOString(),
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

      const updatedAt = new Date();
      const doc: Record<string, unknown> = {
        name: styleData.name,
        prompt: styleData.prompt,
        imagePaths: styleData.imagePaths || [],
        previewUrls: styleData.imagePaths || [],
        updatedAt,
      };

      if (styleData.collageImageUrl !== undefined) {
        doc.collageImageUrl = styleData.collageImageUrl;
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
