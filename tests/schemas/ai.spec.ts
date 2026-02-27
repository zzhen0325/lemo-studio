import { describe, it, expect } from 'vitest';
import { TextRequestSchema, ImageRequestSchema, DescribeRequestSchema } from '@/lib/schemas/ai';

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
});
