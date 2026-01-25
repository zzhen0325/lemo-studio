import type { IStorage, PutObjectOptions, StorageObject } from './IStorage';

/**
 * TOS / S3 等云存储实现占位。
 *
 * 由于当前项目尚未引入 `@byted-service/tos` 等 SDK，这里仅提供接口骨架，并在调用时抛出
 * NotImplemented 错误。后续只需在此文件中接入真实 SDK 并补全实现即可，无需改动业务代码。
 */

export class NotImplementedCloudStorage implements IStorage {
  private notImplemented(method: string): never {
    throw new Error(`[CloudStorage] ${method} is not implemented yet`);
  }

  public async putObject(_key: string, _body: Buffer | Uint8Array | string, _options?: PutObjectOptions): Promise<{ url?: string }> {
    void _key;
    void _body;
    void _options;
    this.notImplemented('putObject');
  }

  public async getObject(_key: string): Promise<Buffer> {
    void _key;
    this.notImplemented('getObject');
  }

  public async deleteObject(_key: string): Promise<void> {
    void _key;
    this.notImplemented('deleteObject');
  }

  public async listObjects(_prefix: string): Promise<StorageObject[]> {
    void _prefix;
    this.notImplemented('listObjects');
  }

  public async copyObject(_sourceKey: string, _destinationKey: string): Promise<void> {
    void _sourceKey;
    void _destinationKey;
    this.notImplemented('copyObject');
  }

  public getPublicUrl(_key: string): string {
    void _key;
    this.notImplemented('getPublicUrl');
  }
}
