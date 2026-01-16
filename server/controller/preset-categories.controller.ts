import { Inject } from '@gulux/gulux';
import { Body, Controller, Get, Post } from '@gulux/gulux/application-http';
import { PresetCategoriesService } from '../service/preset-categories.service';

/**
 * 预设分类配置：
 * - GET  /api/presets/categories
 * - POST /api/presets/categories
 */
@Controller('/presets/categories')
export default class PresetCategoriesController {
  @Inject()
  private readonly service!: PresetCategoriesService;

  @Get()
  public async getCategories() {
    return this.service.getCategories();
  }

  @Post()
  public async postCategories(@Body() categories: string[]) {
    return this.service.saveCategories(categories);
  }
}
