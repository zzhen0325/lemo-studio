import { getProvider } from '../../lib/ai/modelRegistry';
import { getSystemPrompt } from '../../config/system-prompts';
import type {
  VisionGenerationInput,
  ImageGenerationInput,
  TextGenerationInput,
  ImageProvider,
  TextProvider,
} from '../../lib/ai/types';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

export interface DescribeRequestBody {
  image: string;
  model: string;
  profileId?: string;
  systemPrompt?: string;
  prompt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
}

export interface ImageRequestBody {
  prompt?: string;
  model: string;
  width?: number;
  height?: number;
  batchSize?: number;
  aspectRatio?: string;
  imageSize?: string;
  image?: string;
  images?: string[]; // 多张参考图支持
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
}

export interface TextRequestBody {
  input: string;
  model: string;
  profileId?: string;
  systemPrompt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
}

@Injectable()
export class AiService {
  public async describe(body: DescribeRequestBody): Promise<{ text: string }> {
    const { image, model, profileId, systemPrompt: explicitSystemPrompt, prompt, options } = body;

    if (!image) {
      throw new HttpError(400, 'Missing image data');
    }

    if (!model) {
      throw new HttpError(400, 'Missing model ID');
    }

    const providerInstance = getProvider(model);

    // 仅在运行时做一次特性判断
    if (!("describeImage" in providerInstance)) {
      throw new HttpError(400, `Model ${model} does not support vision tasks`);
    }

    let resolvedSystemPrompt = explicitSystemPrompt;
    if (!resolvedSystemPrompt && profileId) {
      let providerIdForPrompt = 'unknown';
      if (model.includes('gemini') || model.includes('google')) providerIdForPrompt = 'google';
      else if (model.includes('doubao')) providerIdForPrompt = 'doubao';
      else if (model.includes('deepseek')) providerIdForPrompt = 'deepseek';

      resolvedSystemPrompt = getSystemPrompt(profileId, providerIdForPrompt);
    }

    const params: VisionGenerationInput = {
      image,
      prompt,
      systemPrompt: resolvedSystemPrompt,
      options,
    };

    const result = await (providerInstance as { describeImage: (p: VisionGenerationInput) => Promise<{ text: string }> }).describeImage(params);
    return { text: result.text };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async generateImage(body: ImageRequestBody): Promise<any> {
    const { prompt, model, width, height, batchSize, aspectRatio, image, images, options } = body;

    if (!model) {
      throw new HttpError(400, 'Missing model ID');
    }

    const providerInstance = getProvider(model);

    if (!("generateImage" in providerInstance)) {
      throw new HttpError(400, `Model ${model} does not support image generation`);
    }

    const params: ImageGenerationInput = {
      prompt: prompt ?? '',
      width,
      height,
      batchSize,
      aspectRatio,
      imageSize: body.imageSize, // 使用 imageSize
      image,
      images, // 传递多张参考图
      options: {
        ...options,
        // Ensure stream is true for coze-image models if we are expecting a stream
        stream: options?.stream === true || model === 'coze_seed4'
      },
    };

    const result = await (providerInstance as unknown as ImageProvider).generateImage(params);
    return result;
  }

  // 文本生成，可能返回流式结果，由调用方决定如何包装 HTTP 响应
  public async generateText(body: TextRequestBody): Promise<{ text?: string; stream?: ReadableStream<Uint8Array> }> {
    const { input, model, profileId, systemPrompt: explicitSystemPrompt, options } = body;

    if (!input) {
      throw new HttpError(400, 'Missing input text');
    }

    if (!model) {
      throw new HttpError(400, 'Missing model ID');
    }

    const providerInstance = getProvider(model);

    let resolvedSystemPrompt = explicitSystemPrompt;
    if (!resolvedSystemPrompt && profileId) {
      let providerIdForPrompt = 'unknown';
      if (model.includes('doubao')) providerIdForPrompt = 'doubao';
      else if (model.includes('deepseek')) providerIdForPrompt = 'deepseek';
      else if (model.includes('gemini')) providerIdForPrompt = 'google';
      else if (model.includes('google')) providerIdForPrompt = 'google';

      resolvedSystemPrompt = getSystemPrompt(profileId, providerIdForPrompt);
    }

    const params: TextGenerationInput = {
      input,
      systemPrompt: resolvedSystemPrompt,
      options,
    };

    if (!("generateText" in providerInstance)) {
      throw new HttpError(400, `Model ${model} does not support text generation`);
    }

    const result = await (providerInstance as TextProvider).generateText(params);

    if (result.stream) {
      return { stream: result.stream as ReadableStream<Uint8Array> };
    }

    return { text: result.text };
  }
}
