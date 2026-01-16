import { Inject } from '@gulux/gulux';
import { Controller, Files, Post } from '@gulux/gulux/application-http';
import { UploadService } from '../service/upload.service';
import { toFileLike } from '../utils/formdata';
import { HttpError } from '../utils/http-error';

/**
 * 图片上传：
 * - POST /api/upload
 */
@Controller('/upload')
export default class UploadController {
  @Inject()
  private readonly service!: UploadService;

  @Post()
  public async postUpload(@Files() files: Record<string, any>) {
    const file = toFileLike(files?.file);
    if (!file) {
      throw new HttpError(400, 'file is required');
    }

    return this.service.upload({
      name: file.name,
      type: file.type,
      arrayBuffer: file.arrayBuffer,
    });
  }
}
