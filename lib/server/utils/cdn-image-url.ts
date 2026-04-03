import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  uploadImageToStorage,
  getFileUrl,
  uploadDataUrl,
} from '@/src/storage/object-storage';

type UploadImageToCdnOptions = {
  preferredSubdir?: string;
  preferredFileName?: string;
  mimeType?: string;
};

function getWorkspaceRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith(`${path.sep}server`) ? path.join(cwd, '..') : cwd;
}

function normalizeSlashPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isBareRemoteUrl(value: string): boolean {
  return /^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\//.test(value);
}

/**
 * Check if a string is a storage key (not a full URL)
 * Storage keys are paths like "ljhwZthlaukjlkulzlp/..." without protocol
 */
function isStorageKey(value: string): boolean {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('blob:')) {
    return false;
  }
  // Storage keys are relative paths with at least one slash
  return value.includes('/') && !value.startsWith('/');
}

function normalizePublicAssetPath(value: string): string | null {
  if (!value.startsWith('/')) {
    return null;
  }

  const normalized = normalizeSlashPath(value).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('api/')) {
    return null;
  }

  return normalized;
}

function extFromMimeType(mimeType?: string): string {
  const lower = mimeType?.toLowerCase() || '';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('svg')) return 'svg';
  return 'png';
}

function mimeTypeFromFileName(fileName: string): string {
  const ext = path.posix.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || `asset_${randomUUID().slice(0, 8)}.png`;
}

function parseDataImageUrl(value: string): { buffer: Buffer; mimeType: string } | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

/**
 * Upload an image buffer to object storage
 * Returns storage key instead of presigned URL for long-term storage
 */
export async function uploadImageBufferToCdn(
  buffer: Buffer,
  options: UploadImageToCdnOptions = {},
): Promise<{ storageKey: string; url: string }> {
  const preferredFileName = sanitizeFileName(
    options.preferredFileName
      || `asset_${Date.now()}_${randomUUID().slice(0, 8)}.${extFromMimeType(options.mimeType)}`,
  );
  const mimeType = options.mimeType || mimeTypeFromFileName(preferredFileName);
  const subdir = options.preferredSubdir || 'upload';

  const storageKey = await uploadImageToStorage(buffer, preferredFileName, subdir, mimeType);
  const url = await getFileUrl(storageKey);

  return { storageKey, url };
}

/**
 * Try to normalize an asset URL to a CDN URL
 * This function handles:
 * - Remote URLs (returned as-is)
 * - Data URLs (uploaded and converted to storage URLs)
 * - Local asset paths (uploaded and converted to storage URLs)
 * 
 * Returns both storageKey (for database) and url (for display)
 */
export async function tryNormalizeAssetUrlToCdn(
  value: string | undefined | null,
  options: UploadImageToCdnOptions = {},
): Promise<{ storageKey?: string; url?: string }> {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return {};
  }

  // Remote URLs are returned as-is (assume they are storage keys or permanent URLs)
  if (isRemoteUrl(trimmed)) {
    // Check if it's already a storage key (path without protocol)
    // If it's a presigned URL, extract the storage key
    const storageKey = extractStorageKeyFromPresignedUrl(trimmed);
    if (storageKey) {
      return { storageKey, url: trimmed };
    }
    // Otherwise return as-is
    return { storageKey: trimmed, url: trimmed };
  }

  if (isBareRemoteUrl(trimmed)) {
    return { storageKey: `https://${trimmed}`, url: `https://${trimmed}` };
  }

  // Handle storage keys (paths like "ljhwZthlaukjlkulzlp/...")
  // These are already normalized storage keys from upload API
  if (isStorageKey(trimmed)) {
    try {
      const url = await getFileUrl(trimmed);
      return { storageKey: trimmed, url };
    } catch (error) {
      console.warn(`[cdn-image-url] Failed to generate URL for storage key: ${trimmed}`, error);
      return { storageKey: trimmed };
    }
  }

  // Blob URLs can't be processed server-side
  if (trimmed.startsWith('blob:')) {
    return {};
  }

  // Handle data URLs
  const parsedDataUrl = parseDataImageUrl(trimmed);
  if (parsedDataUrl) {
    try {
      const result = await uploadDataUrl(trimmed, options.preferredSubdir || 'upload');
      return { storageKey: result.key, url: result.url };
    } catch (error) {
      console.warn(`[cdn-image-url] Failed to upload data URL asset to storage: ${trimmed.slice(0, 48)}...`, error);
      return {};
    }
  }

  // Handle local asset paths
  const publicAssetPath = normalizePublicAssetPath(trimmed);
  if (!publicAssetPath) {
    return {};
  }

  const absolutePath = path.join(getWorkspaceRoot(), 'public', publicAssetPath);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch (error) {
    console.warn(`[cdn-image-url] Missing local asset for storage normalization: ${trimmed}`, error);
    return {};
  }

  const preferredSubdir = options.preferredSubdir || path.posix.dirname(publicAssetPath);
  const preferredFileName = options.preferredFileName || path.posix.basename(publicAssetPath);
  try {
    const result = await uploadImageBufferToCdn(buffer, {
      preferredSubdir,
      preferredFileName,
      mimeType: options.mimeType || mimeTypeFromFileName(preferredFileName),
    });
    return { storageKey: result.storageKey, url: result.url };
  } catch (error) {
    console.warn(`[cdn-image-url] Failed to upload local asset to storage: ${trimmed}`, error);
    return {};
  }
}

/**
 * Extract storage key from a presigned URL
 */
function extractStorageKeyFromPresignedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Check if it's a TOS/S3 URL pattern
    if (!parsed.hostname.includes('tos.coze.site') && !parsed.hostname.includes('tiktokcdn.com')) {
      return null;
    }
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    
    // Skip the bucket name (first part like coze_storage_xxx)
    if (pathParts.length < 2) {
      return null;
    }
    
    let keyStartIndex = 0;
    if (pathParts[0].startsWith('coze_storage_')) {
      keyStartIndex = 1;
    }
    
    if (keyStartIndex >= pathParts.length) {
      return null;
    }
    
    return pathParts.slice(keyStartIndex).join('/') || null;
  } catch {
    return null;
  }
}
