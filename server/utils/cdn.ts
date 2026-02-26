import { randomUUID } from 'crypto';
import path from 'path';
import { fetch, FormData, File } from 'undici';

const CDN_BASE = process.env.NODE_ENV === 'development' ? 'https://ife-cdn.tiktok-row.net' : 'https://ife-cdn.byteintl.net';
const DEFAULT_DIR = process.env.CDN_DIR || 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design';
const DEFAULT_REGION = process.env.CDN_REGION || 'SG';
const DEFAULT_EMAIL = process.env.CDN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'anonymous@localhost');

interface UploadOptions {
  fileName?: string;
  dir?: string;
  region?: string;
  email?: string;
  mimeType?: string;
}

interface UploadResult {
  url: string;
  dir: string;
  fileName: string;
}

function buildUrl(dir: string, fileName: string) {
  return `${CDN_BASE}/${dir}/${fileName}`;
}

async function postForm<T = unknown>(pathName: string, form: FormData): Promise<T> {
  const url = `${CDN_BASE}${pathName}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: form,
      // undici fetch options
      // @ts-expect-error connectTimeout is supported by undici but not in standard fetch types
      connectTimeout: 5000,
    });
  } catch (err: unknown) {
    const error = err as { message: string; code?: string };
    console.error('[CDN Fetch Error]', { url, error: error.message, code: error.code });
    throw new Error(`[cdn] Failed to fetch ${url}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
  }

  let data: unknown = null;
  const text = await res.text().catch(() => '');
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text || {};
  }

  const code = typeof data === 'object' && data !== null ? (data as { code?: number }).code : undefined;
  const message =
    (typeof data === 'object' && data !== null && (data as { message?: unknown }).message) ||
    (typeof data === 'string' && data) ||
    `CDN request failed: ${res.status}`;

  const success = res.ok && (code === 0 || code === undefined || code === 200);
  if (!success) {
    console.error('[CDN Error Detail]', { url, status: res.status, code, data, text: text.slice(0, 500) });
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const detail = text ? ` body=${text}` : '';
    throw new Error(`[cdn ${res.status}] ${msg}${detail}`);
  }
  return data as T;
}

function makeFileName(name?: string) {
  if (name) return name;
  const stamp = Date.now();
  return `img_${stamp}_${randomUUID().slice(0, 6)}.png`;
}

export async function uploadBufferToCdn(buffer: Buffer, opts: UploadOptions = {}): Promise<UploadResult> {
  const fileName = makeFileName(opts.fileName);
  const dir = opts.dir || DEFAULT_DIR;
  const region = opts.region || DEFAULT_REGION;
  const email = opts.email || DEFAULT_EMAIL;
  if (!email) {
    throw new Error('[cdn] Missing CDN email. Set CDN_EMAIL in environment variables.');
  }

  const form = new FormData();
  form.set('dir', dir);
  form.set('region', region);
  form.set('fileName', fileName);
  form.set('email', email);

  // Sniff MIME type from buffer headers if not provided or vague
  let mimeType = opts.mimeType || 'image/png';
  if (mimeType === 'image/png' || !mimeType) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      mimeType = 'image/gif';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      mimeType = 'image/webp'; // Simplified check
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      mimeType = 'image/png';
    }
  }

  form.set('file', new File([buffer], fileName, { type: mimeType }));

  const resp = await postForm<{ fileName?: string; files?: string[]; cdnUrl?: string }>('/cdn/upload', form);
  const finalFileName = resp.fileName || resp.files?.[0] || fileName;
  let finalUrl = resp.cdnUrl;
  if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
    finalUrl = `https://${finalUrl.replace(/^\/\//, '')}`;
  }

  if (!finalUrl || !/^https?:\/\//i.test(finalUrl)) {
    throw new Error(`[cdn] Invalid response: missing or malformed cdnUrl. resp=${JSON.stringify(resp)}`);
  }

  return {
    url: finalUrl,
    dir,
    fileName: finalFileName,
  };
}

export function buildCdnPath(subdir: string, fileName: string, region = DEFAULT_REGION) {
  const dir = path.posix.join(DEFAULT_DIR, subdir).replace(/\\/g, '/');
  // 当前域名未体现 region，保留参数便于未来切换
  void region;
  return buildUrl(dir, fileName);
}
