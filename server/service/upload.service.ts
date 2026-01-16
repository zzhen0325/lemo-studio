import { z } from 'zod';
import { Injectable, Inject } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { uploadBufferToCdn } from '../utils/cdn';
import { ImageAsset } from '../db';

const AllowedExt = ['png', 'jpg', 'jpeg'] as const;

const FileInfoSchema = z.object({
  name: z.string().min(1),
  type: z.string().regex(/^image\//),
});

function getExtFromName(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx !== -1) return name.slice(idx + 1).toLowerCase();
  return 'png';
}

// 与 Web File 接口兼容的最小定义
export interface UploadedFileLike {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

@Injectable()
export class UploadService {
  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async upload(file: UploadedFileLike): Promise<{ path: string }> {
    const infoParse = FileInfoSchema.safeParse({ name: file.name, type: file.type });
    if (!infoParse.success) {
      throw new HttpError(400, 'Invalid file', infoParse.error.flatten());
    }

    const ext = getExtFromName(file.name);
    if (!AllowedExt.includes(ext as (typeof AllowedExt)[number])) {
      throw new HttpError(400, 'Unsupported extension');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || `upload_${Date.now()}.${ext}`;
    const cdnRes = await uploadBufferToCdn(buffer, {
      fileName,
      dir: 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/upload',
      region: 'SG',
    });

    await this.imageAssetModel.create({
      url: cdnRes.url,
      dir: cdnRes.dir,
      fileName: cdnRes.fileName,
      region: 'SG',
      type: 'upload',
    });

    return { path: cdnRes.url };
  }
}
