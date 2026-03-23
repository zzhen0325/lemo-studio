import { z } from 'zod';
import { randomUUID } from 'crypto';
import { Injectable, Inject } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
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

  public async upload(file: UploadedFileLike): Promise<{ path: string; storageKey: string }> {
    const infoParse = FileInfoSchema.safeParse({ name: file.name, type: file.type });
    if (!infoParse.success) {
      throw new HttpError(400, 'Invalid file', infoParse.error.flatten());
    }

    const ext = getExtFromName(file.name);
    if (!AllowedExt.includes(ext as (typeof AllowedExt)[number])) {
      throw new HttpError(400, 'Unsupported extension');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate unique filename to prevent overwrite
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "") || 'image';
    const fileName = `${nameWithoutExt}_${randomUUID()}.${ext}`;
    
    // Upload to storage - only get storage key, not presigned URL
    const cdnRes = await uploadBufferToCdn(buffer, {
      fileName,
      dir: 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/upload',
      region: 'SG',
      mimeType: file.type,
      generateSignedUrl: false, // 不生成预签名 URL，只返回 storageKey
    });

    await this.imageAssetModel.create({
      storage_key: cdnRes.storageKey,
      url: '', // 不再存储预签名 URL
      dir: cdnRes.dir,
      fileName: cdnRes.fileName,
      region: 'SG',
      type: 'upload',
    });

    // 返回 storageKey 作为 path，前端需要适配
    return { 
      path: cdnRes.storageKey, // 存储的是 storageKey
      storageKey: cdnRes.storageKey,
    };
  }
}
