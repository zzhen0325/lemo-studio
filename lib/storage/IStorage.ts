import type { Stats } from 'fs';

export interface PutObjectOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  size?: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
  rawStats?: Stats;
}

export interface IStorage {
  /**
   * 写入对象。
   * @param key 逻辑键，例如 `collection/filename.png`
   */
  putObject(key: string, body: Buffer | Uint8Array | string, options?: PutObjectOptions): Promise<{ url?: string }>;

  /**
   * 读取对象的原始二进制内容。
   */
  getObject(key: string): Promise<Buffer>;

  /**
   * 删除单个对象。
   */
  deleteObject(key: string): Promise<void>;

  /**
   * 按前缀列出对象。
   * 例如 prefix=`collection/` 返回该集合下的所有文件。
   */
  listObjects(prefix: string): Promise<StorageObject[]>;

  /**
   * 复制对象。
   */
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;

  /**
   * 将逻辑 key 转为可公开访问的 URL。
   */
  getPublicUrl(key: string): string;
}
