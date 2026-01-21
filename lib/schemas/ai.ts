import { z } from 'zod';

/**
 * AI 统一请求 Schema
 */

export const TextRequestSchema = z.object({
  input: z.string().min(1, 'input is required'),
  model: z.string().min(1, 'model is required'),
  profileId: z.string().optional(),
  systemPrompt: z.string().optional(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: z.any().optional(),
});

export type TextRequestInput = z.infer<typeof TextRequestSchema>;

export const ImageRequestSchema = z.object({
  prompt: z.string().optional(),
  model: z.string().min(1, 'model is required'),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  batchSize: z.number().int().positive().optional(),
  imageSize: z.string().optional(),
  aspectRatio: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(), // 支持多张参考图
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: z.any().optional(),
});

export type ImageRequestInput = z.infer<typeof ImageRequestSchema>;

export const DescribeRequestSchema = z.object({
  image: z.string().min(1, 'image is required'),
  model: z.string().min(1, 'model is required'),
  profileId: z.string().optional(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: z.any().optional(),
});

export type DescribeRequestInput = z.infer<typeof DescribeRequestSchema>;
