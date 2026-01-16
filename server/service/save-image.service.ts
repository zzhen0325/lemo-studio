import { z } from 'zod';
import { Injectable, Inject } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { uploadBufferToCdn } from '../utils/cdn';
import { ImageAsset } from '../db';

const BodySchema = z.object({
  imageBase64: z.string().min(1),
  ext: z.enum(['png', 'jpg', 'jpeg', 'webp', 'gif']).optional().default('png'),
  subdir: z.enum(['outputs', 'upload']).optional().default('outputs'),
  metadata: z.record(z.any()).optional(),
});

export type SaveImageRequestBody = z.infer<typeof BodySchema>;

function extractBase64(data: string): { base64: string; mime?: string } {
  const match = data.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return { base64: match[2], mime: match[1] };
  }
  return { base64: data };
}

@Injectable()
export class SaveImageService {
  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async save(body: unknown): Promise<{ path: string }> {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const { imageBase64, subdir } = parsed.data;
    let { ext } = parsed.data;

    let imageBuffer: Buffer;
    if (imageBase64.startsWith('http')) {
      const imgResp = await fetch(imageBase64);
      if (!imgResp.ok) {
        throw new HttpError(500, `Failed to download image from ${imageBase64}`);
      }
      const contentType = imgResp.headers.get('content-type');
      if (contentType) {
        if (contentType.includes('jpeg')) ext = 'jpg';
        else if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';
      }
      const arrayBuffer = await imgResp.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      const { base64, mime } = extractBase64(imageBase64);
      if (mime) {
        if (mime.includes('jpeg')) ext = 'jpg';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
      }
      imageBuffer = Buffer.from(base64, 'base64');
    }

    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/${subdir}`;

    const cdnRes = await uploadBufferToCdn(imageBuffer, { fileName: filename, dir, region: 'SG' });

    await this.imageAssetModel.create({
      url: cdnRes.url,
      dir: cdnRes.dir,
      fileName: cdnRes.fileName,
      region: 'SG',
      type: subdir === 'outputs' ? 'generation' : 'upload',
      meta: parsed.data.metadata ?? undefined,
    });

    return { path: cdnRes.url };
  }
}
