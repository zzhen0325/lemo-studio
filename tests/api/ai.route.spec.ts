import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// 通过 mock modelRegistry，避免在测试中访问真实模型与外部服务
const generateTextMock = vi.fn(async (params: { input: string }) => ({ text: `echo:${params.input}` }));
const generateImageMock = vi.fn(async () => ({ images: ['data:image/png;base64,IMAGE'], metadata: {} }));
const describeImageMock = vi.fn(async (params: { image: string }) => ({ text: `description for ${params.image}` }));

vi.mock('@/lib/ai/modelRegistry', () => {
  return {
    getProvider: (model: string) => {
      if (model === 'text-model') {
        return { generateText: generateTextMock };
      }
      if (model === 'image-model') {
        return { generateImage: generateImageMock };
      }
      if (model === 'vision-model') {
        return { describeImage: describeImageMock };
      }
      if (model === 'image-only') {
        // 用于验证文本接口在能力缺失时返回 400
        return { generateImage: generateImageMock };
      }
      if (model === 'text-only') {
        // 用于验证图像接口在能力缺失时返回 400
        return { generateText: generateTextMock };
      }
      throw new Error(`Unknown model in test: ${model}`);
    },
  };
});

// 在 mock 之后导入路由函数
// eslint-disable-next-line import/first
import { POST as textPost } from '../../app/api/ai/text/route';
// eslint-disable-next-line import/first
import { POST as imagePost } from '../../app/api/ai/image/route';
// eslint-disable-next-line import/first
import { POST as describePost } from '../../app/api/ai/describe/route';

function createNextJsonRequest(url: string, body: unknown): NextRequest {
  const base = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return new NextRequest(base);
}

describe('/api/ai/text', () => {
  it('returns 200 and text when payload is valid', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/text', {
      input: 'hello',
      model: 'text-model',
    });

    const res = await textPost(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string };
    expect(json.text).toBe('echo:hello');
    expect(generateTextMock).toHaveBeenCalled();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/text', {
      model: 'text-model',
    });

    const res = await textPost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request payload');
  });

  it('returns 400 when provider does not support text generation', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/text', {
      input: 'hello',
      model: 'image-only',
    });

    const res = await textPost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('does not support text generation');
  });
});

describe('/api/ai/image', () => {
  it('returns 200 and image result for valid payload', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/image', {
      model: 'image-model',
      prompt: 'draw a cat',
      width: 512,
      height: 512,
    });

    const res = await imagePost(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { images: string[] };
    expect(json.images).toHaveLength(1);
    expect(generateImageMock).toHaveBeenCalled();
  });

  it('returns 400 when model is missing', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/image', {
      prompt: 'draw a cat',
    });

    const res = await imagePost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request payload');
  });

  it('returns 400 when provider does not support image generation', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/image', {
      model: 'text-only',
      prompt: 'draw a cat',
    });

    const res = await imagePost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('does not support image generation');
  });
});

describe('/api/ai/describe', () => {
  it('returns 200 and text for valid describe payload', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/describe', {
      image: 'data:image/png;base64,AAA',
      model: 'vision-model',
    });

    const res = await describePost(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string };
    expect(json.text).toBe('description for data:image/png;base64,AAA');
    expect(describeImageMock).toHaveBeenCalled();
  });

  it('returns 400 when image is missing', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/describe', {
      model: 'vision-model',
    });

    const res = await describePost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request payload');
  });

  it('returns 400 when provider does not support describeImage', async () => {
    const req = createNextJsonRequest('http://localhost/api/ai/describe', {
      image: 'data:image/png;base64,AAA',
      model: 'image-model', // 只有 generateImage，无 describeImage
    });

    const res = await describePost(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('does not support vision tasks');
  });
});
