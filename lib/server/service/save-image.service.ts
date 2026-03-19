import { z } from 'zod';
import { Injectable, Inject } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
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

function sanitizeSubdir(subdir: string): string {
  const normalized = subdir
    .replace(/\\/g, '/')
    .replace(/^\//, '')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '');
  return normalized || 'outputs';
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

  public async save(body: unknown): Promise<{ path: string; storageKey: string }> {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.error('[SaveImageService] validation failed:', parsed.error.flatten());
      throw new HttpError(400, 'Invalid payload', parsed.error.flatten());
    }

    const { imageBase64 } = parsed.data;
    const safeSubdir = sanitizeSubdir(parsed.data.subdir);
    let ext = normalizeExt(parsed.data.ext);
    let inferredMime: string | undefined;

    let imageBuffer: Buffer;
    if (imageBase64.startsWith('http')) {
      const downloaded = await fetchImageBuffer(imageBase64);
      imageBuffer = downloaded.buffer;
      inferredMime = downloaded.mime;
    } else {
      const { base64, mime } = extractBase64(imageBase64);
      imageBuffer = Buffer.from(base64, 'base64');
      inferredMime = mime;
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
    const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/${safeSubdir}`;
    
    // 上传到对象存储，获取 storageKey（不生成预签名 URL）
    const cdnRes = await uploadBufferToCdn(imageBuffer, {
      fileName: filename,
      dir,
      region: 'SG',
      mimeType: inferredMime,
      generateSignedUrl: true, // 为了向后兼容，仍然生成预签名 URL 返回给前端
    });

    await this.imageAssetModel.create({
      storage_key: cdnRes.storageKey, // 存储 URI
      url: cdnRes.url, // 可选，预签名 URL
      dir: cdnRes.dir,
      fileName: cdnRes.fileName,
      region: 'SG',
      type: safeSubdir === 'outputs' ? 'generation' : 'upload',
      meta: parsed.data.metadata ?? undefined,
    });

    return { 
      path: cdnRes.url || '', // 返回预签名 URL 供前端使用
      storageKey: cdnRes.storageKey, // 同时返回 storageKey
    };
  }
}
