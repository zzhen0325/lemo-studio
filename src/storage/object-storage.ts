import { S3Storage } from 'coze-coding-dev-sdk';

let storageInstance: S3Storage | null = null;

/**
 * Get the S3 storage instance
 * Uses environment variables for configuration:
 * - COZE_BUCKET_ENDPOINT_URL: S3 endpoint URL
 * - COZE_BUCKET_NAME: Bucket name
 */
export function getObjectStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storageInstance;
}

/**
 * Upload an image buffer to object storage
 * @param buffer - The image buffer to upload
 * @param fileName - The desired file name
 * @param subdir - Optional subdirectory (e.g., 'outputs', 'upload')
 * @param mimeType - Optional MIME type
 * @returns The storage key of the uploaded file
 */
export async function uploadImageToStorage(
  buffer: Buffer,
  fileName: string,
  subdir?: string,
  mimeType?: string
): Promise<string> {
  const storage = getObjectStorage();
  
  // Build the file path with subdirectory
  const key = subdir 
    ? `${subdir}/${fileName}` 
    : fileName;
  
  const actualKey = await storage.uploadFile({
    fileContent: buffer,
    fileName: key,
    contentType: mimeType || 'image/png',
  });
  
  return actualKey;
}

/**
 * Get a signed URL for a file
 * @param key - The storage key
 * @param expireTime - Expiration time in seconds (default: 1 day)
 * @returns The signed URL
 */
export async function getFileUrl(key: string, expireTime: number = 86400): Promise<string> {
  const storage = getObjectStorage();
  return storage.generatePresignedUrl({ key, expireTime });
}

/**
 * Upload from a data URL (base64)
 * @param dataUrl - The data URL to upload
 * @param subdir - Optional subdirectory
 * @returns The storage key and signed URL
 */
export async function uploadDataUrl(
  dataUrl: string,
  subdir?: string
): Promise<{ key: string; url: string }> {
  // Parse data URL
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  
  // Generate file name
  const ext = mimeType.split('/')[1] || 'png';
  const fileName = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  
  const key = await uploadImageToStorage(buffer, fileName, subdir, mimeType);
  const url = await getFileUrl(key);
  
  return { key, url };
}

/**
 * Upload from a remote URL
 * @param url - The remote URL to fetch and upload
 * @returns The storage key
 */
export async function uploadFromUrl(url: string): Promise<string> {
  const storage = getObjectStorage();
  return storage.uploadFromUrl({ url });
}

/**
 * Check if a file exists
 * @param key - The storage key
 * @returns Whether the file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  const storage = getObjectStorage();
  return storage.fileExists({ fileKey: key });
}

/**
 * Delete a file
 * @param key - The storage key
 */
export async function deleteFile(key: string): Promise<boolean> {
  const storage = getObjectStorage();
  return storage.deleteFile({ fileKey: key });
}

/**
 * Read a file
 * @param key - The storage key
 * @returns The file buffer
 */
export async function readFile(key: string): Promise<Buffer> {
  const storage = getObjectStorage();
  return storage.readFile({ fileKey: key });
}
