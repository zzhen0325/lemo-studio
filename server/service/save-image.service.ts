import { z } from 'zod';
import { Injectable, Inject } from '@gulux/gulux';
import type { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { uploadBufferToCdn } from '../utils/cdn';
import { ImageAsset } from '../db';

const BodySchema = z.object({
  imageBase64: z.string(),
  ext: z.string().optional().default('png'),
  subdir: z.string().optional().default('outputs'),
  metadata: z.any().optional(),
});

export type SaveImageRequestBody = z.infer<typeof BodySchema>;

function extractBase64(data: string): { base64: string; mime?: string } {
  const match = data.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return { base64: match[2], mime: match[1] };
  }
  return { base64: data };
}

function normalizeExt(ext: string): string {
  return ext === 'jpeg' ? 'jpg' : ext;
}

function getExtFromMime(mime: string | null | undefined): string | undefined {
  if (!mime) return undefined;
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return undefined;
}

function tryExtractImageUrlFromHtml(html: string): string | null {
  const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (og && /^https?:\/\//i.test(og)) return og;
  const metaRefresh = html.match(/http-equiv=["']refresh["'][^>]*content=["']([^"']*url=)?([^"'>\s]+)["']/i);
  const nextUrl = metaRefresh ? (metaRefresh[2] || metaRefresh[1]) : null;
  if (nextUrl && /^https?:\/\//i.test(nextUrl)) return nextUrl;
  const direct = html.match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/i)?.[0];
  if (direct) return direct;
  const imgTag = html.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1];
  if (imgTag && /^https?:\/\//i.test(imgTag)) return imgTag;
  return null;
}

async function fetchImageBuffer(url: string, depth = 0): Promise<{ buffer: Buffer; mime?: string }> {
  const resp = await fetch(url, {
    headers: {
      accept: 'image/*,*/*;q=0.8',
    },
  });

  if (!resp.ok) {
    const snippet = await resp.text().catch(() => '');
    throw new Error(`Failed to download image: status=${resp.status} url=${url} body=${snippet.slice(0, 200)}`);
  }

  const contentType = resp.headers.get('content-type');
  const mime = contentType?.split(';')[0]?.trim();

  if (mime?.startsWith('image/')) {
    const arrayBuffer = await resp.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mime };
  }

  const text = await resp.text().catch(() => '');
  if (depth < 1) {
    const nextUrl = tryExtractImageUrlFromHtml(text);
    if (nextUrl) {
      return fetchImageBuffer(nextUrl, depth + 1);
    }
  }

  throw new Error(`Downloaded content is not an image: mime=${mime || 'unknown'} url=${url} body=${text.slice(0, 500)}`);
}

@Injectable()
export class SaveImageService {
  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async save(body: unknown): Promise<{ path: string }> {
    console.log('[SaveImageService] request body keys:', typeof body === 'object' && body ? Object.keys(body) : 'none');
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.error('[SaveImageService] validation failed:', parsed.error.flatten());
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const { imageBase64, subdir } = parsed.data;
    let ext = normalizeExt(parsed.data.ext);
    let inferredMime: string | undefined;

    let imageBuffer: Buffer;
    if (imageBase64.startsWith('http')) {
      console.log('[SaveImageService] fetching URL:', imageBase64);
      const downloaded = await fetchImageBuffer(imageBase64);
      console.log('[SaveImageService] downloaded size:', downloaded.buffer.length, 'mime:', downloaded.mime);
      imageBuffer = downloaded.buffer;
      inferredMime = downloaded.mime;
    } else {
      console.log('[SaveImageService] processing base64');
      const { base64, mime } = extractBase64(imageBase64);
      imageBuffer = Buffer.from(base64, 'base64');
      inferredMime = mime;
      console.log('[SaveImageService] base64 size:', imageBuffer.length, 'mime:', mime);
    }

    // 后验逻辑：如果推断的 MIME 依然无法确定或与内容不符，通过文件头识别
    if (!inferredMime || inferredMime === 'application/octet-stream') {
      // 简单识别：JFIF (JPEG) FFD8
      if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
        inferredMime = 'image/jpeg';
      } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4e && imageBuffer[3] === 0x47) {
        inferredMime = 'image/png';
      }
    }

    const inferredExt = getExtFromMime(inferredMime);
    if (inferredExt) {
      ext = inferredExt;
    }

    const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/${subdir}`;

    console.log('[SaveImageService] uploading to CDN:', { filename, dir, inferredMime });
    const cdnRes = await uploadBufferToCdn(imageBuffer, {
      fileName: filename,
      dir,
      region: 'SG',
      mimeType: inferredMime
    });
    console.log('[SaveImageService] upload success:', cdnRes.url);

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
