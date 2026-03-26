import { describe, it, expect } from 'vitest';
import { TextRequestSchema, ImageRequestSchema, DescribeRequestSchema, DesignVariantEditRequestSchema } from '@/lib/schemas/ai';

describe('AI request schemas', () => {
  describe('TextRequestSchema', () => {
    it('accepts a valid payload', () => {
      const result = TextRequestSchema.safeParse({
        input: 'hello world',
        model: 'test-text-model',
        profileId: 'profile-1',
        systemPrompt: 'you are a test',
        options: { temperature: 0.5 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          input: 'hello world',
          model: 'test-text-model',
          profileId: 'profile-1',
          systemPrompt: 'you are a test',
        });
      }
    });

    it('rejects missing required fields', () => {
      const result = TextRequestSchema.safeParse({ model: 'test-text-model' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.input && fieldErrors.input.length).toBeGreaterThan(0);
      }
    });

    it('rejects wrong field types', () => {
      const result = TextRequestSchema.safeParse({
        input: 123,
        model: 456,
      });

      expect(result.success).toBe(false);
    });

    it('ignores extra fields', () => {
      const result = TextRequestSchema.safeParse({
        input: 'hello',
        model: 'test-text-model',
        extra: 'should be stripped',
      } as unknown as Record<string, unknown>);

      expect(result.success).toBe(true);
      if (result.success) {
        // Zod 在默认配置下会丢弃未知字段
        expect((result.data as Record<string, unknown>).extra).toBeUndefined();
      }
    });
  });

  describe('ImageRequestSchema', () => {
    it('accepts a minimal valid payload', () => {
      const result = ImageRequestSchema.safeParse({
        model: 'test-image-model',
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing model', () => {
      const result = ImageRequestSchema.safeParse({ prompt: 'draw something' });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.model && fieldErrors.model.length).toBeGreaterThan(0);
      }
    });

    it('rejects negative dimensions', () => {
      const result = ImageRequestSchema.safeParse({
        model: 'test-image-model',
        width: -1,
        height: -10,
      });

      expect(result.success).toBe(false);
    });

    it('allows optional numeric fields', () => {
      const result = ImageRequestSchema.safeParse({
        model: 'test-image-model',
        width: 512,
        height: 512,
        batchSize: 2,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('DescribeRequestSchema', () => {
    it('accepts a valid payload', () => {
      const result = DescribeRequestSchema.safeParse({
        image: 'data:image/png;base64,xxx',
        model: 'test-vision-model',
        prompt: 'describe this image',
        context: 'service:datasetLabel',
      });

      expect(result.success).toBe(true);
    });

    it('rejects missing image', () => {
      const result = DescribeRequestSchema.safeParse({
        model: 'test-vision-model',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.image && fieldErrors.image.length).toBeGreaterThan(0);
      }
    });

    it('rejects missing model', () => {
      const result = DescribeRequestSchema.safeParse({
        image: 'data:image/png;base64,xxx',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.model && fieldErrors.model.length).toBeGreaterThan(0);
      }
    });

    it('ignores unknown fields for describe', () => {
      const result = DescribeRequestSchema.safeParse({
        image: 'data:image/png;base64,xxx',
        model: 'test-vision-model',
        extra: 'unknown',
      } as unknown as Record<string, unknown>);

      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).extra).toBeUndefined();
      }
    });

    it('rejects unsupported context for describe', () => {
      const result = DescribeRequestSchema.safeParse({
        image: 'data:image/png;base64,xxx',
        model: 'test-vision-model',
        context: 'playground',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('DesignVariantEditRequestSchema', () => {
    const validPayload = {
      instruction: '请换一个更有创意的主体物，并让场景更有故事性。',
      scope: 'variant',
      variant: {
        id: 'v1',
        label: '贴纸拼贴',
        coreFields: {
          mainTitle: '#Biweeklybudget',
          subTitle: 'Tell us what you actually spend in 2 weeks with #biweeklybudget',
          eventTime: '8/1-8/31',
          style: '拼贴、插画',
          primaryColor: '#15BC55',
        },
        coreSuggestions: {
          mainTitle: '',
          subTitle: '',
          eventTime: '',
          style: '',
          primaryColor: '',
        },
        palette: [
          { hex: '#15BC55', weight: '' },
        ],
        analysis: {
          canvas: { tokens: ['拼贴海报'], detailText: '绿色主导的拼贴海报。' },
          subject: { tokens: ['预算账本主体'], detailText: '主体是一册夸张放大的预算账本。' },
          background: { tokens: ['便签背景'], detailText: '背景是米色纸张与便签。' },
          layout: { tokens: ['居中构图'], detailText: '主标题在中间。' },
          typography: { tokens: ['圆角黑体'], detailText: '标题使用圆角黑体。' },
        },
        promptPreview: 'A playful budget collage poster...',
      },
      context: {
        shortcutId: 'us-kv',
        shortcutPrompt: 'Create a US-EVENT KV with main title ...',
        market: 'US',
      },
    };

    it('accepts a valid payload', () => {
      const result = DesignVariantEditRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('rejects missing instruction', () => {
      const result = DesignVariantEditRequestSchema.safeParse({
        ...validPayload,
        instruction: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects unsupported scope', () => {
      const result = DesignVariantEditRequestSchema.safeParse({
        ...validPayload,
        scope: 'prompt',
      });
      expect(result.success).toBe(false);
    });
  });
});
