import { Inject } from '@gulux/gulux';
import { Body, Controller, Delete, Files, Get, Post, Query } from '@gulux/gulux/application-http';
import { ToolsPresetsService } from '../service/tools-presets.service';
import { buildFormDataLike } from '../utils/formdata';
import { HttpError } from '../utils/http-error';

/**
 * 工具预设：
 * - GET    /api/tools/presets?toolId=xxx
 * - POST   /api/tools/presets
 * - DELETE /api/tools/presets?id=xxx&toolId=xxx
 */
@Controller('/tools/presets')
export default class ToolsPresetsController {
  @Inject()
  private readonly service!: ToolsPresetsService;

  @Get()
  public async getPresets(@Query('toolId') toolId?: string) {
    if (!toolId) {
      throw new HttpError(400, 'Missing toolId');
    }
    return this.service.listPresets(toolId);
  }

  @Post()
  public async postPreset(
    @Body() body: Record<string, unknown>,
    @Files() files: Record<string, any>,
  ) {
    const formData = buildFormDataLike(body, files);
    return this.service.savePresetFromFormData(formData as FormData);
  }

  @Delete()
  public async deletePreset(@Query('id') id?: string, @Query('toolId') toolId?: string) {
    if (!id || !toolId) {
      throw new HttpError(400, 'Missing id or toolId');
    }
    await this.service.deletePreset(toolId, id);
    return { success: true };
  }
}
