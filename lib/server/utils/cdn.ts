import { randomUUID } from 'crypto';
import {
  uploadImageToStorage,
  getFileUrl,
} from '@/src/storage/object-storage';

// Keep these for backward compatibility
export const DEFAULT_CDN_DIR = process.env.CDN_DIR || 'lemo-studio';
const DEFAULT_REGION = process.env.CDN_REGION || 'cn-beijing';

interface UploadOptions {
  fileName?: string;
  dir?: string;
  region?: string;
  email?: string;
  mimeType?: string;
  // 是否生成预签名 URL（默认 false，只返回 storageKey）
  generateSignedUrl?: boolean;
  // 预签名 URL 过期时间（秒）
  signedUrlExpireTime?: number;
}

interface UploadResult {
  storageKey: string; // 对象存储 URI
  url?: string; // 预签名 URL（仅当 generateSignedUrl 为 true 时返回）
  dir: string;
  fileName: string;
}

function makeFileName(name?: string): string {
  if (name) return name;
  const stamp = Date.now();
  return `img_${stamp}_${randomUUID().slice(0, 6)}.png`;
}

/**
 * Upload a buffer to object storage
 * This replaces the old CDN upload with S3-compatible object storage
 * 
 * @param buffer - The image buffer to upload
 * @param opts - Upload options
 * @returns Upload result with storageKey (URI) and optionally signed URL
 */
export async function uploadBufferToCdn(buffer: Buffer, opts: UploadOptions = {}): Promise<UploadResult> {
  const fileName = makeFileName(opts.fileName);
  const dir = opts.dir || DEFAULT_CDN_DIR;
  const mimeType = opts.mimeType || 'image/png';

  // Build the storage key (URI)
  // Upload to object storage - returns the actual key
  const actualKey = await uploadImageToStorage(buffer, fileName, dir, mimeType);

  const result: UploadResult = {
    storageKey: actualKey,
    dir,
    fileName: actualKey.split('/').pop() || fileName,
  };

  // Only generate signed URL if explicitly requested
  if (opts.generateSignedUrl) {
    result.url = await getFileUrl(actualKey, opts.signedUrlExpireTime);
  }

  return result;
}

/**
 * Get a signed URL for a storage key
 * Use this when you need to access an image stored by its URI
 * 
 * @param storageKey - The storage key (URI) from the database
 * @param expireTime - URL expiration time in seconds (default: 1 day)
 * @returns Signed URL for accessing the image
 */
export async function getSignedUrlForStorageKey(storageKey: string, expireTime: number = 86400): Promise<string> {
  return getFileUrl(storageKey, expireTime);
}

/**
 * Build CDN path (kept for backward compatibility)
 */
export function buildCdnPath(subdir: string, fileName: string, region = DEFAULT_REGION): string {
  void region;
  const key = `${DEFAULT_CDN_DIR}/${subdir}/${fileName}`;
  return key;
}
