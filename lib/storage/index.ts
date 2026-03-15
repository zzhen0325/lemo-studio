import { LocalStorage } from './local';
import { NotImplementedCloudStorage } from './tos';
import type { IStorage } from './IStorage';

/**
 * 根据环境变量创建存储实例：
 * - CLOUD_STORAGE=tos | s3: 预留云存储实现（当前为占位，调用会抛出 NotImplemented）
 * - 其他 / 未设置: 默认使用本地文件系统 public/dataset
 */
export function createStorage(): IStorage {
  const mode = (process.env.CLOUD_STORAGE || 'local').toLowerCase();

  if (mode === 'tos' || mode === 's3') {
    // 未来可在 NotImplementedCloudStorage 内接入 @byted-service/tos 或 S3 SDK
    return new NotImplementedCloudStorage();
  }

  return new LocalStorage();
}
