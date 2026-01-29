"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotImplementedCloudStorage = void 0;
/**
 * TOS / S3 等云存储实现占位。
 *
 * 由于当前项目尚未引入 `@byted-service/tos` 等 SDK，这里仅提供接口骨架，并在调用时抛出
 * NotImplemented 错误。后续只需在此文件中接入真实 SDK 并补全实现即可，无需改动业务代码。
 */
class NotImplementedCloudStorage {
    notImplemented(method) {
        throw new Error(`[CloudStorage] ${method} is not implemented yet`);
    }
    async putObject(_key, _body, _options) {
        void _key;
        void _body;
        void _options;
        this.notImplemented('putObject');
    }
    async getObject(_key) {
        void _key;
        this.notImplemented('getObject');
    }
    async deleteObject(_key) {
        void _key;
        this.notImplemented('deleteObject');
    }
    async listObjects(_prefix) {
        void _prefix;
        this.notImplemented('listObjects');
    }
    async copyObject(_sourceKey, _destinationKey) {
        void _sourceKey;
        void _destinationKey;
        this.notImplemented('copyObject');
    }
    getPublicUrl(_key) {
        void _key;
        this.notImplemented('getPublicUrl');
    }
}
exports.NotImplementedCloudStorage = NotImplementedCloudStorage;
