"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorage = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const DATASET_ROOT = process.env.DATASET_DIR || path_1.default.join(process.cwd(), 'public/dataset');
async function ensureDir(dirPath) {
    try {
        await fs_1.promises.access(dirPath);
    }
    catch {
        await fs_1.promises.mkdir(dirPath, { recursive: true });
    }
}
function buildPublicUrlFromKey(key) {
    const base = process.env.CLOUD_PUBLIC_BASE;
    const normalizedKey = key.replace(/^\/+/, '');
    if (base && base.trim().length > 0) {
        return `${base.replace(/\/+$/, '')}/${normalizedKey}`;
    }
    // 本地模式：通过 Next 静态资源 `/dataset/...` 暴露
    return `/dataset/${normalizedKey}`;
}
class LocalStorage {
    root;
    constructor(rootDir = DATASET_ROOT) {
        this.root = rootDir;
    }
    resolvePath(key) {
        const safeKey = key.replace(/\\/g, '/');
        return path_1.default.join(this.root, safeKey);
    }
    async putObject(key, body, _options) {
        const filePath = this.resolvePath(key);
        const dir = path_1.default.dirname(filePath);
        await ensureDir(dir);
        const buffer = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body);
        await fs_1.promises.writeFile(filePath, buffer);
        return { url: buildPublicUrlFromKey(key) };
    }
    async getObject(key) {
        const filePath = this.resolvePath(key);
        return fs_1.promises.readFile(filePath);
    }
    async deleteObject(key) {
        const filePath = this.resolvePath(key);
        await fs_1.promises.rm(filePath, { force: true });
    }
    async listObjects(prefix) {
        const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\\/g, '/');
        const startDir = this.resolvePath(normalizedPrefix);
        const objects = [];
        async function walk(dir, baseKey) {
            let entries;
            try {
                entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                const abs = path_1.default.join(dir, entry.name);
                const relKey = baseKey ? `${baseKey}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    await walk(abs, relKey);
                }
                else {
                    try {
                        const stat = await fs_1.promises.stat(abs);
                        objects.push({
                            key: relKey,
                            size: stat.size,
                            lastModified: stat.mtime,
                            rawStats: stat,
                        });
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
        const baseKey = normalizedPrefix.replace(/\/+$/, '');
        await walk(startDir, baseKey);
        return objects;
    }
    async copyObject(sourceKey, destinationKey) {
        const src = this.resolvePath(sourceKey);
        const dest = this.resolvePath(destinationKey);
        const dir = path_1.default.dirname(dest);
        await ensureDir(dir);
        await fs_1.promises.copyFile(src, dest);
    }
    getPublicUrl(key) {
        return buildPublicUrlFromKey(key);
    }
}
exports.LocalStorage = LocalStorage;
