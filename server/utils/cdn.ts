import { randomUUID } from 'crypto';
import path from 'path';
import { fetch, FormData, File } from 'undici';

const CDN_BASE = 'https://ife-cdn.byteintl.net';
const DEFAULT_DIR = 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design';
const DEFAULT_REGION = 'SG';
const DEFAULT_EMAIL = 'zzhen.0325@bytedance.com';

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
  const res = await fetch(`${CDN_BASE}${pathName}`, {
    method: 'POST',
    body: form,
  });

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
    console.error('[CDN Error Detail]', { status: res.status, code, data, text: text.slice(0, 500) });
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

  const form = new FormData();
  form.set('dir', dir);
  form.set('region', region);
  form.set('fileName', fileName);
  form.set('email', email);
  form.set('file', new File([buffer], fileName, { type: opts.mimeType || 'image/png' }));

  const resp = await postForm<{ fileName?: string; files?: string[]; cdnUrl?: string }>('/cdn/upload', form);
  const finalFileName = resp.fileName || resp.files?.[0] || fileName;
  let finalUrl = resp.cdnUrl;
  if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
    finalUrl = `https://${finalUrl.replace(/^\/\//, '')}`;
  }

  if (!finalUrl || !/^https?:\/\//i.test(finalUrl)) {
    throw new Error(`[cdn] Invalid response: missing or malformed cdnUrl. resp=${JSON.stringify(resp)}`);
  }

  console.log('[cdn-upload]', { dir, region, email, finalFileName, cdnUrl: finalUrl });

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

