"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorage = createStorage;
const local_1 = require("./local");
const tos_1 = require("./tos");
/**
 * 根据环境变量创建存储实例：
 * - CLOUD_STORAGE=tos | s3: 预留云存储实现（当前为占位，调用会抛出 NotImplemented）
 * - 其他 / 未设置: 默认使用本地文件系统 public/dataset
 */
function createStorage() {
    const mode = (process.env.CLOUD_STORAGE || 'local').toLowerCase();
    if (mode === 'tos' || mode === 's3') {
        // 未来可在 NotImplementedCloudStorage 内接入 @byted-service/tos 或 S3 SDK
        return new tos_1.NotImplementedCloudStorage();
    }
    return new local_1.LocalStorage();
}
