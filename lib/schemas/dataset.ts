import { z } from 'zod';

/**
 * Dataset 相关请求体 / 查询参数的统一 Zod Schema
 */

const SafePathSegmentSchema = z
  .string()
  .trim()
  .min(1, 'value is required')
  .refine((value) => !value.includes('/'), 'value must not contain "/"')
  .refine((value) => !value.includes('\\'), 'value must not contain "\\"')
  .refine((value) => !value.includes('\0'), 'value must not contain null byte')
  .refine((value) => value !== '.' && value !== '..', 'value must not be "." or ".."');

export const DatasetQuerySchema = z.object({
  collection: SafePathSegmentSchema.optional().nullable(),
});

export type DatasetQueryInput = z.infer<typeof DatasetQuerySchema>;

export const DatasetPostSchema = z.object({
  // 注意：file 为 multipart/form-data 中的文件字段，无法在这里直接验证
  collection: SafePathSegmentSchema,
  mode: z.string().optional().nullable(),
  newName: SafePathSegmentSchema.optional().nullable(),
});

export type DatasetPostInput = z.infer<typeof DatasetPostSchema>;

export const DatasetDeleteSchema = z.object({
  collection: SafePathSegmentSchema,
  filename: SafePathSegmentSchema.optional().nullable(),
  // 逗号分隔的文件名字符串
  filenames: z
    .string()
    .optional()
    .nullable()
    .refine((raw) => {
      if (!raw) return true;
      const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
      return items.every((item) => SafePathSegmentSchema.safeParse(item).success);
    }, 'filenames contains invalid filename'),
});

export type DatasetDeleteInput = z.infer<typeof DatasetDeleteSchema>;

export const DatasetUpdateSchema = z.object({
  collection: SafePathSegmentSchema,
  filename: SafePathSegmentSchema.optional(),
  prompt: z.string().optional(),
  promptLang: z.enum(['zh', 'en']).optional(),
  // filename -> prompt
  prompts: z.record(SafePathSegmentSchema, z.string()).optional(),
  systemPrompt: z.string().optional(),
  order: z.array(SafePathSegmentSchema).optional(),
  mode: z.enum(['batchRename', 'renameCollection']).optional(),
  prefix: SafePathSegmentSchema.optional(),
  newCollectionName: SafePathSegmentSchema.optional(),
});

export type DatasetUpdateInput = z.infer<typeof DatasetUpdateSchema>;
