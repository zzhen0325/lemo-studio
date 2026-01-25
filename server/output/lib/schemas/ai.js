"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescribeRequestSchema = exports.ImageRequestSchema = exports.TextRequestSchema = void 0;
const zod_1 = require("zod");
/**
 * AI 统一请求 Schema
 */
exports.TextRequestSchema = zod_1.z.object({
    input: zod_1.z.string().min(1, 'input is required'),
    model: zod_1.z.string().min(1, 'model is required'),
    profileId: zod_1.z.string().optional(),
    systemPrompt: zod_1.z.string().optional(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: zod_1.z.any().optional(),
});
exports.ImageRequestSchema = zod_1.z.object({
    prompt: zod_1.z.string().optional(),
    model: zod_1.z.string().min(1, 'model is required'),
    width: zod_1.z.number().int().positive().optional(),
    height: zod_1.z.number().int().positive().optional(),
    batchSize: zod_1.z.number().int().positive().optional(),
    imageSize: zod_1.z.string().optional(),
    aspectRatio: zod_1.z.string().optional(),
    image: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.string()).optional(), // 支持多张参考图
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: zod_1.z.any().optional(),
});
exports.DescribeRequestSchema = zod_1.z.object({
    image: zod_1.z.string().min(1, 'image is required'),
    model: zod_1.z.string().min(1, 'model is required'),
    profileId: zod_1.z.string().optional(),
    systemPrompt: zod_1.z.string().optional(),
    prompt: zod_1.z.string().optional(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: zod_1.z.any().optional(),
});
