import { PresetsRepository } from '../repositories';
import { HttpError } from '../utils/http-error';
import { readJsonAsset } from '../../runtime-assets';

const CATEGORIES_PATH = 'public/preset/categories.json';
const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];

export class PresetCategoriesService {
  constructor(private readonly presetsRepository: PresetsRepository) {}

  public async getCategories(): Promise<string[]> {
    try {
      const doc = await this.presetsRepository.getCategoriesRecord();
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
      await this.presetsRepository.saveCategories(categories);
      return categories;
    } catch (error) {
      console.error('Failed to save categories to DB', error);
      throw new HttpError(500, 'Failed to save categories');
    }
  }
}
