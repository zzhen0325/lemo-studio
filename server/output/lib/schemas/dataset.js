"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetUpdateSchema = exports.DatasetDeleteSchema = exports.DatasetPostSchema = exports.DatasetQuerySchema = void 0;
const zod_1 = require("zod");
/**
 * Dataset 相关请求体 / 查询参数的统一 Zod Schema
 */
exports.DatasetQuerySchema = zod_1.z.object({
    collection: zod_1.z.string().min(1).optional().nullable(),
});
exports.DatasetPostSchema = zod_1.z.object({
    // 注意：file 为 multipart/form-data 中的文件字段，无法在这里直接验证
    collection: zod_1.z.string().min(1, 'collection is required'),
    mode: zod_1.z.string().optional().nullable(),
    newName: zod_1.z.string().optional().nullable(),
});
exports.DatasetDeleteSchema = zod_1.z.object({
    collection: zod_1.z.string().min(1, 'collection is required'),
    filename: zod_1.z.string().optional().nullable(),
    // 逗号分隔的文件名字符串
    filenames: zod_1.z.string().optional().nullable(),
});
exports.DatasetUpdateSchema = zod_1.z.object({
    collection: zod_1.z.string().min(1, 'collection is required'),
    filename: zod_1.z.string().optional(),
    prompt: zod_1.z.string().optional(),
    // filename -> prompt
    prompts: zod_1.z.record(zod_1.z.string()).optional(),
    systemPrompt: zod_1.z.string().optional(),
    order: zod_1.z.array(zod_1.z.string()).optional(),
    mode: zod_1.z.enum(['batchRename', 'renameCollection']).optional(),
    prefix: zod_1.z.string().optional(),
    newCollectionName: zod_1.z.string().optional(),
});
