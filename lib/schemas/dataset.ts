import { z } from 'zod';

/**
 * Dataset 相关请求体 / 查询参数的统一 Zod Schema
 */

export const DatasetQuerySchema = z.object({
  collection: z.string().min(1).optional().nullable(),
});

export type DatasetQueryInput = z.infer<typeof DatasetQuerySchema>;

export const DatasetPostSchema = z.object({
  // 注意：file 为 multipart/form-data 中的文件字段，无法在这里直接验证
  collection: z.string().min(1, 'collection is required'),
  mode: z.string().optional().nullable(),
  newName: z.string().optional().nullable(),
});

export type DatasetPostInput = z.infer<typeof DatasetPostSchema>;

export const DatasetDeleteSchema = z.object({
  collection: z.string().min(1, 'collection is required'),
  filename: z.string().optional().nullable(),
  // 逗号分隔的文件名字符串
  filenames: z.string().optional().nullable(),
});

export type DatasetDeleteInput = z.infer<typeof DatasetDeleteSchema>;

export const DatasetUpdateSchema = z.object({
  collection: z.string().min(1, 'collection is required'),
  filename: z.string().optional(),
  prompt: z.string().optional(),
  // filename -> prompt
  prompts: z.record(z.string()).optional(),
  systemPrompt: z.string().optional(),
  order: z.array(z.string()).optional(),
  mode: z.enum(['batchRename', 'renameCollection']).optional(),
  prefix: z.string().optional(),
  newCollectionName: z.string().optional(),
});

export type DatasetUpdateInput = z.infer<typeof DatasetUpdateSchema>;
