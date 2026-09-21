import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { localAppOrigin } from '../../local-runtime';

export function localStorageRoot(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || '.local/objects');
}

export function resolveLocalStorageKey(key: string): string {
  if (!key || key.includes('\\') || key.includes('\0') || key.split('/').some(p => p === '..' || p === '.' || !p)) {
    throw new Error('Invalid local storage key');
  }
  const root = localStorageRoot();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid local storage key');
  return resolved;
}

export class LocalObjectStorageRepository {
  async uploadFile(input: { fileContent: Buffer; fileName: string; contentType?: string }): Promise<string> {
    const target = resolveLocalStorageKey(input.fileName);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, input.fileContent);
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return input.fileName;
  }

  async generatePresignedUrl({ key }: { key: string; expireTime?: number }): Promise<string> {
    resolveLocalStorageKey(key);
    return `${localAppOrigin()}/api/storage/local?key=${encodeURIComponent(key)}`;
  }

  async readFile({ fileKey }: { fileKey: string }): Promise<Buffer> {
    return fs.readFile(resolveLocalStorageKey(fileKey));
  }

  async fileExists({ fileKey }: { fileKey: string }): Promise<boolean> {
    try {
      return (await fs.stat(resolveLocalStorageKey(fileKey))).isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async deleteFile({ fileKey }: { fileKey: string }): Promise<boolean> {
    try {
      await fs.unlink(resolveLocalStorageKey(fileKey));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async uploadFromUrl({ url }: { url: string }): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    const extension = ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[contentType] || 'png';
    return this.uploadFile({
      fileContent: Buffer.from(await response.arrayBuffer()),
      fileName: `ljhwZthlaukjlkulzlp/local/${randomUUID()}.${extension}`,
      contentType,
    });
  }
}
