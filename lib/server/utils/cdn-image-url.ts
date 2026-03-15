import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { DEFAULT_CDN_DIR, uploadBufferToCdn } from './cdn';

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

function buildCdnDir(subdir?: string): string {
  const normalized = normalizeSlashPath(subdir || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  return normalized ? path.posix.join(DEFAULT_CDN_DIR, normalized) : DEFAULT_CDN_DIR;
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

export async function uploadImageBufferToCdn(
  buffer: Buffer,
  options: UploadImageToCdnOptions = {},
): Promise<string> {
  const preferredFileName = sanitizeFileName(
    options.preferredFileName
      || `asset_${Date.now()}_${randomUUID().slice(0, 8)}.${extFromMimeType(options.mimeType)}`,
  );
  const mimeType = options.mimeType || mimeTypeFromFileName(preferredFileName);
  const uploaded = await uploadBufferToCdn(buffer, {
    fileName: preferredFileName,
    dir: buildCdnDir(options.preferredSubdir),
    region: 'SG',
    mimeType,
  });
  return uploaded.url;
}

export async function tryNormalizeAssetUrlToCdn(
  value: string | undefined | null,
  options: UploadImageToCdnOptions = {},
): Promise<string | undefined> {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return undefined;
  }

  if (isRemoteUrl(trimmed)) {
    return trimmed;
  }

  if (isBareRemoteUrl(trimmed)) {
    return `https://${trimmed}`;
  }

  if (trimmed.startsWith('blob:')) {
    return undefined;
  }

  const parsedDataUrl = parseDataImageUrl(trimmed);
  if (parsedDataUrl) {
    try {
      return await uploadImageBufferToCdn(parsedDataUrl.buffer, {
        preferredSubdir: options.preferredSubdir || 'upload',
        preferredFileName: options.preferredFileName,
        mimeType: parsedDataUrl.mimeType,
      });
    } catch (error) {
      console.warn(`[cdn-image-url] Failed to upload data URL asset to CDN: ${trimmed.slice(0, 48)}...`, error);
      return undefined;
    }
  }

  const publicAssetPath = normalizePublicAssetPath(trimmed);
  if (!publicAssetPath) {
    return undefined;
  }

  const absolutePath = path.join(getWorkspaceRoot(), 'public', publicAssetPath);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch (error) {
    console.warn(`[cdn-image-url] Missing local asset for CDN normalization: ${trimmed}`, error);
    return undefined;
  }

  const preferredSubdir = options.preferredSubdir || path.posix.dirname(publicAssetPath);
  const preferredFileName = options.preferredFileName || path.posix.basename(publicAssetPath);
  try {
    return await uploadImageBufferToCdn(buffer, {
      preferredSubdir,
      preferredFileName,
      mimeType: options.mimeType || mimeTypeFromFileName(preferredFileName),
    });
  } catch (error) {
    console.warn(`[cdn-image-url] Failed to upload local asset to CDN: ${trimmed}`, error);
    return undefined;
  }
}
