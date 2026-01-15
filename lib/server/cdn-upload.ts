export interface UploadToCDNOptions {
  region?: string;
  dir?: string;
  email?: string;
  autoRefresh?: boolean;
}

function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  return fallback;
}

function getContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export interface CdnUploadResponse {
  code: number;
  cdnUrl?: string;
  domain?: string;
  path?: string;
  tosKey?: string;
  message?: string;
}

/**
 * 将二进制图片数据上传到 Byteintl CDN，并返回 cdnUrl。
 *
 * - 默认从环境变量读取配置：
 *   - CDN_BASE_URL (默认 https://ife-cdn.byteintl.net)
 *   - CDN_REGION (默认 SG)
 *   - CDN_DIR (默认 ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design)
 *   - CDN_EMAIL (默认 zzhen.0325@bytedance.com)
 *   - CDN_TOKEN (可选，若团队空间加密则必须配置，用于 header: x-cdn-token)
 */
export async function uploadToCDN(
  buffer: Buffer,
  filename: string,
  options: UploadToCDNOptions = {},
): Promise<string> {
  const baseUrl = (getEnv('CDN_BASE_URL', 'https://ife-cdn.byteintl.net') || '').replace(/\/$/, '');
  const url = `${baseUrl}/cdn/upload`;

  const region = options.region ?? getEnv('CDN_REGION', 'SG') ?? 'SG';
  const dir = options.dir ?? getEnv('CDN_DIR', 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design')!;
  const email = options.email ?? getEnv('CDN_EMAIL', 'zzhen.0325@bytedance.com')!;

  if (!dir) {
    throw new Error('CDN_DIR is not configured');
  }
  if (!email) {
    throw new Error('CDN_EMAIL is not configured');
  }

  const formData = new FormData();
  formData.append('dir', dir);
  formData.append('region', region);
  formData.append('email', email);
  if (options.autoRefresh) {
    formData.append('autoRefresh', 'true');
  }

  const contentType = getContentType(filename);
  const blob = new Blob([buffer], { type: contentType });
  formData.append('file', blob, filename);

  const headers: Record<string, string> = {};
  const token = getEnv('CDN_TOKEN');
  if (token) {
    headers['x-cdn-token'] = token;
  }

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CDN upload failed with status ${res.status}: ${text}`);
  }

  let data: CdnUploadResponse;
  try {
    data = (await res.json()) as CdnUploadResponse;
  } catch (err) {
    throw new Error(`CDN upload response is not valid JSON: ${String(err)}`);
  }

  if (data.code !== 0) {
    throw new Error(`CDN upload error (code ${data.code}): ${data.message || 'unknown error'}`);
  }

  if (data.cdnUrl && data.cdnUrl.length > 0) {
    // 有些返回不带协议，这里统一补全
    if (data.cdnUrl.startsWith('http://') || data.cdnUrl.startsWith('https://')) {
      return data.cdnUrl;
    }
    if (data.domain && data.path !== undefined) {
      const domain = data.domain.replace(/\/$/, '');
      const path = data.cdnUrl.startsWith('/') ? data.cdnUrl : `/${data.cdnUrl}`;
      return `https://${domain}${path}`;
    }
    // 仅返回 cdnUrl 的情况，由调用方自行处理
    return data.cdnUrl;
  }

  if (data.domain && data.path && data.tosKey) {
    const domain = data.domain.replace(/\/$/, '');
    const path = data.path.replace(/\/$/, '');
    const key = data.tosKey.startsWith('/') ? data.tosKey : `/${data.tosKey}`;
    return `https://${domain}${path}${key}`;
  }

  throw new Error('CDN upload succeeded but cdnUrl is missing in response');
}
