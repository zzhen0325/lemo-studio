import { Inject } from '@gulux/gulux';
import { Body, Controller, Header, Post, Res, Files } from '@gulux/gulux/application-http';
import type { HTTPResponse } from '@gulux/gulux/application-http';
import { ComfyService } from '../service/comfy.service';
import { buildFormDataLike } from '../utils/formdata';

/**
 * Comfy 工作流接口：
 * - POST /api/comfy
 * 请求体 multipart/form-data：workflow、viewComfy、apiKey、comfyUrl
 * 返回 octet-stream，内容为以 `--BLOB_SEPARATOR--` 分隔的多文件数据
 */
@Controller('/comfy')
export default class ComfyController {
  @Inject()
  private readonly comfyService!: ComfyService;

  @Post()
  public async postComfy(
    @Body() body: Record<string, unknown>,
    @Files() files: Record<string, any>,
    @Header('x-tt-logid') logIdHeader?: string,
    @Header('X-TT-LOGID') logIdHeaderUpper?: string,
    @Res() res?: HTTPResponse,
  ) {
    const formData = buildFormDataLike(body, files);
    const logId = logIdHeader ?? logIdHeaderUpper;

    const stream = await this.comfyService.runWorkflowFromFormData(formData as FormData, logId);
    if (res) {
      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', 'attachment; filename="generated_images.bin"');
      res.body = stream;
      return;
    }
    return { stream };
  }
}
