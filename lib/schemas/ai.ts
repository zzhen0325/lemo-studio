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
  context: z.enum(['service:describe', 'service:datasetLabel']).optional(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: z.any().optional(),
});

export type DescribeRequestInput = z.infer<typeof DescribeRequestSchema>;

const DesignStructuredCoreFieldsSchema = z.object({
  mainTitle: z.string(),
  subTitle: z.string(),
  eventTime: z.string(),
  style: z.string(),
  primaryColor: z.string(),
});

const DesignStructuredPaletteEntrySchema = z.object({
  hex: z.string(),
  weight: z.string(),
});

const DesignStructuredAnalysisSectionSchema = z.object({
  detailText: z.string(),
});

const DesignStructuredAnalysisSchema = z.object({
  canvas: DesignStructuredAnalysisSectionSchema,
  subject: DesignStructuredAnalysisSectionSchema,
  background: DesignStructuredAnalysisSectionSchema,
  layout: DesignStructuredAnalysisSectionSchema,
  typography: DesignStructuredAnalysisSectionSchema,
});

export const DesignStructuredVariantSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  coreFields: DesignStructuredCoreFieldsSchema,
  coreSuggestions: DesignStructuredCoreFieldsSchema,
  palette: z.array(DesignStructuredPaletteEntrySchema).optional().default([]),
  analysis: DesignStructuredAnalysisSchema,
  promptPreview: z.string(),
});

export const DesignVariantEditRequestSchema = z.object({
  instruction: z.string().min(1, 'instruction is required'),
  scope: z.enum(['variant', 'canvas', 'subject', 'background', 'layout', 'typography']),
  variant: DesignStructuredVariantSchema,
  context: z.object({
    shortcutId: z.string().min(1, 'shortcutId is required'),
    shortcutPrompt: z.string().min(1, 'shortcutPrompt is required'),
    market: z.string().optional(),
  }),
});

export type DesignVariantEditRequestInput = z.infer<typeof DesignVariantEditRequestSchema>;

export const DesignSectionEditRequestSchema = z.object({
  variantId: z.string().min(1, 'variantId is required'),
  sectionKey: z.enum(['canvas', 'subject', 'background', 'layout', 'typography']),
  instruction: z.string().min(1, 'instruction is required'),
  currentSectionText: z.string(),
  fullAnalysisContext: DesignStructuredAnalysisSchema,
  shortcutContext: z.object({
    shortcutId: z.string().min(1, 'shortcutId is required'),
    shortcutPrompt: z.string().min(1, 'shortcutPrompt is required'),
    market: z.string().optional(),
  }),
});

export type DesignSectionEditRequestInput = z.infer<typeof DesignSectionEditRequestSchema>;
