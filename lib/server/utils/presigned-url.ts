import { getFileUrl } from '@/src/storage/object-storage';

/**
 * Extract storage key from a presigned URL
 * 
 * Example URL:
 * https://coze-coding-project.tos.coze.site/coze_storage_7617306962664947731/ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/outputs/img_xxx.png?sign=xxx
 * 
 * Storage key would be:
 * ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/outputs/img_xxx.png
 */
export function extractStorageKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Check if it's a TOS/S3 URL pattern
    // Pattern: https://bucket.tos.region.xxx/bucket_prefix/storage_key?sign=xxx
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    // The URL format is: /coze_storage_xxx/ljhwZthlaukjlkulzlp/Lemon8_Activity/...
    // Skip the first part (bucket name like coze_storage_7617306962664947731)
    // The rest is the storage key
    
    if (pathParts.length < 2) {
      return null;
    }
    
    // Check if first part is the bucket name (starts with coze_storage_)
    let keyStartIndex = 0;
    if (pathParts[0].startsWith('coze_storage_')) {
      keyStartIndex = 1;
    }
    
    if (keyStartIndex >= pathParts.length) {
      return null;
    }
    
    // The rest is the storage key
    const storageKey = pathParts.slice(keyStartIndex).join('/');
    return storageKey || null;
  } catch {
    return null;
  }
}

/**
 * Check if a presigned URL is expired or about to expire
 * 
 * @param url - The presigned URL to check
 * @param bufferSeconds - How many seconds before expiration to consider "expiring" (default: 1 hour)
 */
export function isPresignedUrlExpired(url: string, bufferSeconds: number = 3600): boolean {
  try {
    const parsed = new URL(url);
    const sign = parsed.searchParams.get('sign');
    
    if (!sign) {
      // No sign parameter, not a presigned URL
      return false;
    }
    
    // The sign parameter format is: timestamp-random-signature
    // The timestamp is the expiration time in Unix seconds
    const timestampPart = sign.split('-')[0];
    const expirationTime = parseInt(timestampPart, 10);
    
    if (isNaN(expirationTime)) {
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return now >= (expirationTime - bufferSeconds);
  } catch {
    return false;
  }
}

/**
 * Check if URL is a TOS/S3 presigned URL
 */
export function isTosPresignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes('tos.coze.site') ||
      parsed.hostname.includes('tiktokcdn.com') ||
      parsed.searchParams.has('sign')
    );
  } catch {
    return false;
  }
}

/**
 * Refresh a presigned URL if it's expired
 * 
 * @param url - The URL to potentially refresh
 * @param expireTime - New expiration time in seconds (default: 1 day)
 * @returns The refreshed URL or original if not applicable
 */
export async function refreshPresignedUrl(
  url: string,
  expireTime: number = 86400
): Promise<string> {
  // Only process TOS presigned URLs
  if (!isTosPresignedUrl(url)) {
    return url;
  }
  
  // Check if expired
  if (!isPresignedUrlExpired(url)) {
    return url;
  }
  
  // Extract storage key
  const storageKey = extractStorageKeyFromUrl(url);
  if (!storageKey) {
    console.warn('[presigned-url] Failed to extract storage key from URL:', url.slice(0, 100));
    return url;
  }
  
  try {
    // Generate new presigned URL
    const newUrl = await getFileUrl(storageKey, expireTime);
    console.log('[presigned-url] Refreshed expired URL for key:', storageKey, 'new URL:', newUrl.slice(0, 120));
    return newUrl;
  } catch (error) {
    console.error('[presigned-url] Failed to refresh URL:', error);
    return url;
  }
}

/**
 * Batch refresh multiple URLs
 */
export async function refreshPresignedUrls(
  urls: (string | undefined | null)[],
  expireTime: number = 86400
): Promise<(string | undefined)[]> {
  return Promise.all(
    urls.map(async (url) => {
      if (!url) return undefined;
      return refreshPresignedUrl(url, expireTime);
    })
  );
}
