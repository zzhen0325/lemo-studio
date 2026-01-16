import fs from 'fs/promises';
import path from 'path';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

const CATEGORIES_PATH = path.join(process.cwd(), 'public/preset/categories.json');
const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];

async function ensureDir() {
  const dir = path.dirname(CATEGORIES_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

@Injectable()
export class PresetCategoriesService {
  public async getCategories(): Promise<string[]> {
    await ensureDir();
    try {
      const content = await fs.readFile(CATEGORIES_PATH, 'utf-8');
      return JSON.parse(content) as string[];
    } catch {
      return DEFAULT_CATEGORIES;
    }
  }

  public async saveCategories(categories: string[]): Promise<string[]> {
    await ensureDir();
    try {
      await fs.writeFile(CATEGORIES_PATH, JSON.stringify(categories, null, 2));
      return categories;
    } catch (error) {
      console.error('Failed to save categories', error);
      throw new HttpError(500, 'Failed to save categories');
    }
  }
}
