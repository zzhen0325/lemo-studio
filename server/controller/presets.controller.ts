import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Files, Get, Post, Query } from '@gulux/gulux/application-http';
import { PresetsService } from '../service/presets.service';
import { buildFormDataLike } from '../utils/formdata';
import { HttpError } from '../utils/http-error';

/**
 * Playground 预设配置：
 * - GET    /api/presets
 * - POST   /api/presets
 * - DELETE /api/presets?id=xxx
 */
@Controller('/presets')
export default class PresetsController {
  @Inject()
  private readonly service!: PresetsService;

  @Get()
  public async getPresets() {
    return this.service.listPresets();
  }

  @Post()
  public async postPreset(
    @Body() body: Record<string, unknown>,
    @Files() files: Record<string, unknown>,
  ) {
    const formData = buildFormDataLike(body, files);
    return this.service.savePresetFromFormData(formData as FormData);
  }

  @Delete()
  public async deletePreset(@Query('id') id?: string) {
    if (!id) {
      throw new HttpError(400, 'Missing ID');
    }
    await this.service.deletePreset(id);
    return { success: true };
  }
}
