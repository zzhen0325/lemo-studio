import { randomUUID } from 'crypto';
import {
  getObjectStorage,
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
}

interface UploadResult {
  url: string;
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
 */
export async function uploadBufferToCdn(buffer: Buffer, opts: UploadOptions = {}): Promise<UploadResult> {
  const fileName = makeFileName(opts.fileName);
  const dir = opts.dir || DEFAULT_CDN_DIR;
  const mimeType = opts.mimeType || 'image/png';

  // Build the key path
  const key = `${dir}/${fileName}`;

  // Upload to object storage
  const actualKey = await uploadImageToStorage(buffer, fileName, dir, mimeType);

  // Get a signed URL for the file
  const url = await getFileUrl(actualKey);

  return {
    url,
    dir,
    fileName: actualKey.split('/').pop() || fileName,
  };
}

/**
 * Build CDN path (kept for backward compatibility)
 */
export function buildCdnPath(subdir: string, fileName: string, region = DEFAULT_REGION): string {
  const key = `${DEFAULT_CDN_DIR}/${subdir}/${fileName}`;
  return key;
}
