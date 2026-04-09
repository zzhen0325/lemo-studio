/**
 * Gallery 图片解析工具
 * 
 * 解析优先级：
 * 1. 如果值是 storageKey（ljhwZthlaukjlkulzlp/...），转成 /storage/image?key=...
 * 2. 如果值是对象存储的 presigned URL，先提取 storageKey，再转成 /storage/image?key=...
 * 3. 如果值是普通第三方外链，直接使用原始 URL
 * 
 * 禁止走 /api/proxy-image?url=...，因为线上 403 已证明服务端代抓不稳定
 */

import { getApiBase, extractStorageKeyFromPresignedUrl, STORAGE_KEY_PREFIX } from './api-base';

const GALLERY_PREVIEW_DEFAULT_WIDTH = 384;
const GALLERY_PREVIEW_DEFAULT_QUALITY = 72;
const STORAGE_IMAGE_PATH_SUFFIX = '/storage/image';

interface StorageImageOptions {
  width?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

function buildStorageImageUrl(storageKey: string, options?: StorageImageOptions): string {
  const apiBase = getApiBase();
  const params = new URLSearchParams({
    key: storageKey,
  });

  if (options?.width) {
    params.set('w', String(options.width));
  }
  if (options?.quality) {
    params.set('q', String(options.quality));
  }
  if (options?.format) {
    params.set('format', options.format);
  }

  return `${apiBase}/storage/image?${params.toString()}`;
}

function extractStorageKeyFromGalleryUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith(STORAGE_KEY_PREFIX)) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return extractStorageKeyFromPresignedUrl(url);
  }

  if (!url.startsWith('/')) {
    return null;
  }

  try {
    const parsed = new URL(url, 'http://placeholder.local');
    if (!parsed.pathname.endsWith(STORAGE_IMAGE_PATH_SUFFIX)) {
      return null;
    }

    const key = parsed.searchParams.get('key');
    return key?.startsWith(STORAGE_KEY_PREFIX) ? key : null;
  } catch {
    return null;
  }
}

/**
 * Gallery 专用图片解析函数
 * 
 * @param url - 原始图片 URL（可能是 storageKey、presigned URL 或普通外链）
 * @returns 解析后的图片 URL
 */
export function resolveGalleryImageUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }
  
  // 1. 处理本地存储 ID
  if (url.startsWith('local:')) {
    return url;
  }
  
  // 2. 处理 data: 和 blob: URL
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // 3. 处理 storageKey 格式（ljhwZthlaukjlkulzlp/...）
  const storageKey = extractStorageKeyFromGalleryUrl(url);
  if (storageKey) {
    return buildStorageImageUrl(storageKey);
  }
  
  // 4. 处理本地静态资源（以 / 开头）
  if (url.startsWith('/')) {
    return url;
  }
  
  // 5. 处理 HTTP(S) URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // 6. 普通第三方外链，直接返回原始 URL
    return url;
  }
  
  // 7. 其他情况，返回原始值
  return url;
}

/**
 * 批量解析图片 URL
 */
export function resolveGalleryImageUrls(urls: (string | undefined | null)[]): string[] {
  return urls
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map(resolveGalleryImageUrl);
}

export function resolveGalleryPreviewUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }

  const storageKey = extractStorageKeyFromGalleryUrl(url);
  if (storageKey) {
    return buildStorageImageUrl(storageKey, {
      width: GALLERY_PREVIEW_DEFAULT_WIDTH,
      quality: GALLERY_PREVIEW_DEFAULT_QUALITY,
      format: 'webp',
    });
  }

  if (url.startsWith('local:') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) {
    return resolveGalleryImageUrl(url);
  }

  return resolveGalleryImageUrl(url);
}
