import { afterEach, describe, expect, it, vi } from 'vitest';

import { translatePromptsBatch } from '@/app/studio/dataset/_components/collection-detail/collection-detail.service';

describe('collection detail translate service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends dataset prompt translation through /api/translate instead of /api/ai/text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translatedTexts: ['hello'] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await translatePromptsBatch(['你好'], 'en');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/translate');
    expect(String(url)).not.toContain('/api/ai/text');
  });
});
