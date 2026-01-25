import { promises as fs } from 'fs';
import path from 'path';
import type { IStorage, PutObjectOptions, StorageObject } from './IStorage';

const DATASET_ROOT = process.env.DATASET_DIR || path.join(process.cwd(), 'public/dataset');

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

function buildPublicUrlFromKey(key: string): string {
  const base = process.env.CLOUD_PUBLIC_BASE;
  const normalizedKey = key.replace(/^\/+/, '');
  if (base && base.trim().length > 0) {
    return `${base.replace(/\/+$/, '')}/${normalizedKey}`;
  }
  // 本地模式：通过 Next 静态资源 `/dataset/...` 暴露
  return `/dataset/${normalizedKey}`;
}

export class LocalStorage implements IStorage {
  private root: string;

  constructor(rootDir: string = DATASET_ROOT) {
    this.root = rootDir;
  }

  private resolvePath(key: string): string {
    const safeKey = key.replace(/\\/g, '/');
    return path.join(this.root, safeKey);
  }

  public async putObject(key: string, body: Buffer | Uint8Array | string, options?: PutObjectOptions): Promise<{ url?: string }> {
    // options are unused in local storage
    void options;
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    const buffer = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
    await fs.writeFile(filePath, buffer);
    return { url: buildPublicUrlFromKey(key) };
  }

  public async getObject(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    return fs.readFile(filePath);
  }

  public async deleteObject(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.rm(filePath, { force: true });
  }

  public async listObjects(prefix: string): Promise<StorageObject[]> {
    const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\\/g, '/');
    const startDir = this.resolvePath(normalizedPrefix);

    const objects: StorageObject[] = [];

    async function walk(dir: string, baseKey: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        const relKey = baseKey ? `${baseKey}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(abs, relKey);
        } else {
          try {
            const stat = await fs.stat(abs);
            objects.push({
              key: relKey,
              size: stat.size,
              lastModified: stat.mtime,
              rawStats: stat,
            });
          } catch {
            // ignore
          }
        }
      }
    }

    const baseKey = normalizedPrefix.replace(/\/+$/, '');
    await walk(startDir, baseKey);
    return objects;
  }

  public async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const src = this.resolvePath(sourceKey);
    const dest = this.resolvePath(destinationKey);
    const dir = path.dirname(dest);
    await ensureDir(dir);
    await fs.copyFile(src, dest);
  }

  public getPublicUrl(key: string): string {
    return buildPublicUrlFromKey(key);
  }
}
