import { describe, expect, it } from 'vitest';

import { extractCozeRunText } from '@/lib/server/ai/coze-run';

describe('extractCozeRunText', () => {
  it('prefers text-like fields in JSON payloads', () => {
    const payload = {
      data: {
        output: {
          text: 'structured response body',
        },
      },
    };

    expect(extractCozeRunText(payload)).toBe('structured response body');
  });

  it('falls back through nested result fields', () => {
    const payload = {
      result: {
        message: {
          content: 'final content text',
        },
      },
    };

    expect(extractCozeRunText(payload)).toBe('final content text');
  });

  it('ignores bare URLs when better text exists', () => {
    const payload = {
      data: {
        url: 'https://example.com/foo',
        result: 'usable answer',
      },
    };

    expect(extractCozeRunText(payload)).toBe('usable answer');
  });
});
