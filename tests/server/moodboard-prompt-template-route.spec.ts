import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/moodboard-cards/prompt-template/route';

describe('POST /api/moodboard-cards/prompt-template', () => {
  const originalPromptToken = process.env.LEMO_COZE_PROMPT_API_TOKEN;
  const originalCozeToken = process.env.LEMO_COZE_API_TOKEN;
  const originalRunUrl = process.env.LEMO_COZE_PROMPT_RUN_URL;

  beforeEach(() => {
    process.env.LEMO_COZE_PROMPT_API_TOKEN = 'test-prompt-token';
    process.env.LEMO_COZE_PROMPT_RUN_URL = 'https://m5385m4ryw.coze.site/run';
  });

  afterEach(() => {
    if (originalPromptToken === undefined) {
      delete process.env.LEMO_COZE_PROMPT_API_TOKEN;
    } else {
      process.env.LEMO_COZE_PROMPT_API_TOKEN = originalPromptToken;
    }
    if (originalCozeToken === undefined) {
      delete process.env.LEMO_COZE_API_TOKEN;
    } else {
      process.env.LEMO_COZE_API_TOKEN = originalCozeToken;
    }
    if (originalRunUrl === undefined) {
      delete process.env.LEMO_COZE_PROMPT_RUN_URL;
    } else {
      process.env.LEMO_COZE_PROMPT_RUN_URL = originalRunUrl;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns prompt template for one image', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ expanded_prompt: 'single image prompt template' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(new Request('http://localhost/api/moodboard-cards/prompt-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['https://example.com/1.png'],
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      promptTemplate: 'single image prompt template',
      imageCount: 1,
    });
  });

  it('caps input images to 4 before sending to coze', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ expanded_prompt: 'multi image prompt template' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(new Request('http://localhost/api/moodboard-cards/prompt-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [
          'https://example.com/1.png',
          'https://example.com/2.png',
          'https://example.com/3.png',
          'https://example.com/4.png',
          'https://example.com/5.png',
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images).toHaveLength(4);
    expect(body.images[0]).toMatchObject({ url: 'https://example.com/1.png', file_type: 'image' });
    expect(body.images[3]).toMatchObject({ url: 'https://example.com/4.png', file_type: 'image' });

    await expect(response.json()).resolves.toEqual({
      promptTemplate: 'multi image prompt template',
      imageCount: 4,
    });
  });

  it('returns 502 when upstream coze request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream failed',
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(new Request('http://localhost/api/moodboard-cards/prompt-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['https://example.com/1.png'],
      }),
    }));

    expect(response.status).toBe(502);
    const payload = await response.json();
    expect(payload.error).toContain('Coze Prompt API Error');
  });
});
