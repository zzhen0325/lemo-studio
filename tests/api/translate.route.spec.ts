import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/translate/route';

function createJsonRequest(body: unknown): NextRequest {
  const request = new Request('http://localhost/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextRequest(request);
}

describe('/api/translate route', () => {
  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_TRANS_API_KEY;
  });

  it('translates single text and returns translatedText', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            translations: [{ translatedText: 'hello' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const req = createJsonRequest({ text: '你好', target: 'en' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { translatedText: string };
    expect(json.translatedText).toBe('hello');
  });

  it('translates texts[] and returns translatedTexts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            translations: [{ translatedText: 'hello' }, { translatedText: 'world' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const req = createJsonRequest({ texts: ['你好', '世界'], target: 'en' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { q: string[] };
    expect(Array.isArray(body.q)).toBe(true);
    expect(body.q).toEqual(['你好', '世界']);

    const json = (await res.json()) as { translatedTexts: string[] };
    expect(json.translatedTexts).toEqual(['hello', 'world']);
  });

  it('returns 400 when both text and texts are missing', async () => {
    const req = createJsonRequest({ target: 'en' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Text is required');
  });
});
