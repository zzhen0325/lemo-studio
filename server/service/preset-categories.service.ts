import { Inject, Injectable } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { PresetCategory } from '../db';
import { readJsonAsset } from '../../lib/runtime-assets';

const CATEGORIES_PATH = 'public/preset/categories.json';
const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];

@Injectable()
export class PresetCategoriesService {
  @Inject(PresetCategory)
  private categoryModel!: ModelType<PresetCategory>;

  public async getCategories(): Promise<string[]> {
    try {
      const doc = await this.categoryModel.findOne({ key: 'default' }).lean();
      if (doc && doc.categories && doc.categories.length > 0) {
        return doc.categories;
      }

      // Try migration
      const fromFile = await this.migrateFromFiles();
      if (fromFile) return fromFile;

      return DEFAULT_CATEGORIES;
    } catch (error) {
      console.error('Failed to get categories from DB', error);
      return DEFAULT_CATEGORIES;
    }
  }

  private async migrateFromFiles(): Promise<string[] | null> {
    try {
      const categories = await readJsonAsset<string[]>(CATEGORIES_PATH);
      if (categories && categories.length > 0) {
        await this.saveCategories(categories);
        return categories;
      }
    } catch { /* ignore */ }
    return null;
  }

  public async saveCategories(categories: string[]): Promise<string[]> {
    try {
      await this.categoryModel.updateOne(
        { key: 'default' },
        { categories },
        { upsert: true }
      );
      return categories;
    } catch (error) {
      console.error('Failed to save categories to DB', error);
      throw new HttpError(500, 'Failed to save categories');
    }
  }
}
