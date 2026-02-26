import { describe, it, expect } from 'vitest';
import {
  DatasetQuerySchema,
  DatasetPostSchema,
  DatasetDeleteSchema,
  DatasetUpdateSchema,
} from '@/lib/schemas/dataset';

describe('Dataset schemas', () => {
  describe('DatasetQuerySchema', () => {
    it('allows empty query (list all collections)', () => {
      const result = DatasetQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collection).toBeUndefined();
      }
    });

    it('rejects empty collection name', () => {
      const result = DatasetQuerySchema.safeParse({ collection: '' });
      expect(result.success).toBe(false);
    });

    it('accepts non-empty collection name', () => {
      const result = DatasetQuerySchema.safeParse({ collection: 'my-collection' });
      expect(result.success).toBe(true);
    });
  });

  describe('DatasetPostSchema', () => {
    it('requires non-empty collection', () => {
      const ok = DatasetPostSchema.safeParse({ collection: 'set-1' });
      const fail = DatasetPostSchema.safeParse({ collection: '' });

      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });

    it('supports duplicate mode with optional newName', () => {
      const result = DatasetPostSchema.safeParse({
        collection: 'set-1',
        mode: 'duplicate',
        newName: 'set-2',
      });

      expect(result.success).toBe(true);
    });

    it('rejects unsafe collection/newName path segments', () => {
      const badCollection = DatasetPostSchema.safeParse({
        collection: '../set-1',
      });
      const badNewName = DatasetPostSchema.safeParse({
        collection: 'set-1',
        mode: 'duplicate',
        newName: 'nested/set-2',
      });

      expect(badCollection.success).toBe(false);
      expect(badNewName.success).toBe(false);
    });
  });

  describe('DatasetDeleteSchema', () => {
    it('requires collection but allows optional filename/filenames', () => {
      const single = DatasetDeleteSchema.safeParse({
        collection: 'set-1',
        filename: 'a.jpg',
      });
      const batch = DatasetDeleteSchema.safeParse({
        collection: 'set-1',
        filenames: 'a.jpg,b.jpg',
      });
      const missingCollection = DatasetDeleteSchema.safeParse({ filenames: 'a.jpg' });

      expect(single.success).toBe(true);
      expect(batch.success).toBe(true);
      expect(missingCollection.success).toBe(false);
    });

    it('keeps raw comma-separated filenames string for further parsing', () => {
      const result = DatasetDeleteSchema.safeParse({
        collection: 'set-1',
        filenames: 'a.jpg,b.jpg,, c.jpg , ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const raw = result.data.filenames ?? '';
        const parsed = raw
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);

        expect(parsed).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
      }
    });

    it('rejects unsafe filename segments', () => {
      const result = DatasetDeleteSchema.safeParse({
        collection: 'set-1',
        filenames: 'a.jpg,../b.jpg',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('DatasetUpdateSchema', () => {
    it('requires non-empty collection', () => {
      const ok = DatasetUpdateSchema.safeParse({ collection: 'set-1' });
      const fail = DatasetUpdateSchema.safeParse({ collection: '' });

      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });

    it('supports batchRename mode with prefix and order', () => {
      const result = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        mode: 'batchRename',
        prefix: 'demo',
        order: ['a.jpg', 'b.jpg'],
      });

      expect(result.success).toBe(true);
    });

    it('supports renameCollection with newCollectionName', () => {
      const result = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        mode: 'renameCollection',
        newCollectionName: 'set-2',
      });

      expect(result.success).toBe(true);
    });

    it('supports promptLang and rejects invalid values', () => {
      const valid = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        prompts: { 'a.jpg': 'hello' },
        promptLang: 'en',
      });
      const invalid = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        prompts: { 'a.jpg': 'hello' },
        promptLang: 'jp',
      });

      expect(valid.success).toBe(true);
      expect(invalid.success).toBe(false);
    });

    it('rejects invalid mode value', () => {
      const result = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        mode: 'unknown',
      });

      expect(result.success).toBe(false);
    });

    it('rejects unsafe filename/prefix/newCollectionName values', () => {
      const badFilename = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        filename: 'nested/a.jpg',
      });
      const badPrefix = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        mode: 'batchRename',
        prefix: '../x',
      });
      const badCollectionName = DatasetUpdateSchema.safeParse({
        collection: 'set-1',
        mode: 'renameCollection',
        newCollectionName: 'new/set',
      });

      expect(badFilename.success).toBe(false);
      expect(badPrefix.success).toBe(false);
      expect(badCollectionName.success).toBe(false);
    });
  });
});
