import { randomUUID } from 'crypto';
import type { StyleStack } from '@/types/database';
import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { StyleStack as StyleStackEntity } from '../db';

@Injectable()
export class StylesService {
  @Inject(StyleStackEntity)
  private styleStackModel!: ModelType<StyleStackEntity>;

  public async listStyles(): Promise<StyleStack[]> {
    try {
      const styles = await this.styleStackModel.find().sort({ updatedAt: -1 }).lean();
      return styles.map((s) => ({
        id: String(s._id),
        name: s.name,
        prompt: s.prompt,
        imagePaths:
          (s.imagePaths && s.imagePaths.length > 0
            ? s.imagePaths
            : s.previewUrls || []) as string[],
        updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()).toISOString(),
      }));
    } catch (error) {
      console.error('Failed to fetch styles', error);
      throw new HttpError(500, 'Failed to fetch styles');
    }
  }

  public async saveStyle(styleData: StyleStack): Promise<StyleStack> {
    try {
      if (!styleData.id) {
        styleData.id = randomUUID();
      }

      const updatedAt = new Date();
      const doc = {
        name: styleData.name,
        prompt: styleData.prompt,
        imagePaths: styleData.imagePaths || [],
        previewUrls: styleData.imagePaths || [],
        updatedAt,
      };

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
