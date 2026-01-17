import { NextResponse } from 'next/server';
import { z } from 'zod';
import { uploadBufferToCdn } from '../../../server/utils/cdn';

const BodySchema = z.object({
  imageBase64: z.string(),
  ext: z.string().optional().default('png'),
  subdir: z.string().optional().default('outputs'),
  metadata: z.any().optional(),
});

type ImageExt = z.infer<typeof BodySchema>['ext'];

function extractBase64(data: string): { base64: string; mime?: string } {
  const match = data.match(/^data:(.*?);base64,(.*)$/);
  if (match) {
    return { base64: match[2], mime: match[1] };
  }
  return { base64: data };
}

function normalizeExt(ext: ImageExt): Exclude<ImageExt, 'jpeg'> {
  return ext === 'jpeg' ? 'jpg' : ext;
}

function getExtFromMime(mime: string | null | undefined): Exclude<ImageExt, 'jpeg'> | undefined {
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
  const metaRefresh = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)["']/i)?.[1];
  if (metaRefresh && /^https?:\/\//i.test(metaRefresh)) return metaRefresh;
  const direct = html.match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/i)?.[0];
  if (direct) return direct;
  return null;
}

async function fetchImageBuffer(url: string, depth = 0): Promise<{ buffer: Buffer; mime?: string }> {
  const resp = await fetch(url, {
    redirect: 'follow',
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

  throw new Error(`Downloaded content is not an image: mime=${mime || 'unknown'} url=${url}`);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      console.log('[API] /api/save-image invalid payload', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { imageBase64, subdir } = parsed.data;
    console.log('[API] /api/save-image request received:', { subdir, isUrl: imageBase64.startsWith('http') });
    let ext = normalizeExt(parsed.data.ext as ImageExt);

    let imageBuffer: Buffer;
    if (imageBase64.startsWith('http')) {
      console.log('[API] /api/save-image fetching URL:', imageBase64);
      const downloaded = await fetchImageBuffer(imageBase64);
      console.log('[API] /api/save-image downloaded size:', downloaded.buffer.length, 'mime:', downloaded.mime);
      const inferred = getExtFromMime(downloaded.mime);
      if (inferred) ext = inferred;
      imageBuffer = downloaded.buffer;
    } else {
      console.log('[API] /api/save-image processing base64');
      const { base64, mime } = extractBase64(imageBase64);
      const inferred = getExtFromMime(mime);
      if (inferred) ext = inferred;
      imageBuffer = Buffer.from(base64, 'base64');
      console.log('[API] /api/save-image base64 size:', imageBuffer.length, 'mime:', mime);
    }

    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `img_${stamp}_${rand}.${ext}`;
    const dir = `ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/${subdir}`;

    console.log('[API] /api/save-image uploading to CDN:', { filename, dir });
    const cdnRes = await uploadBufferToCdn(imageBuffer, { fileName: filename, dir, region: 'SG' });
    console.log('[API] /api/save-image upload success:', cdnRes.url);
    return NextResponse.json({ path: cdnRes.url });
  } catch (error) {
    console.error('[API] /api/save-image fatal error:', error);
    return NextResponse.json({ error: 'Failed to save image', details: String(error) }, { status: 500 });
  }
}
