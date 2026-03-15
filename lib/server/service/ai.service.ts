import { getProvider } from '../../ai/modelRegistry';
import { getSystemPrompt } from '../../../config/system-prompts';
import type {
  VisionGenerationInput,
  ImageGenerationInput,
  TextGenerationInput,
  ImageProvider,
  TextProvider,
} from '../../ai/types';
import { Inject, Injectable, Logger } from '../compat/gulux';
import { HttpError } from '../utils/http-error';
import { ApiConfigService } from './api-config.service';
import { normalizeImageSizeToken, validateModelUsage } from '../../model-center';
import { serviceSupportsSystemPrompt } from '../../api-config/types';

export interface DescribeRequestBody {
  image: string;
  model: string;
  profileId?: string;
  systemPrompt?: string;
  prompt?: string;
  context?: 'service:describe' | 'service:datasetLabel';
  options?: Record<string, unknown>;
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
  options?: Record<string, unknown>;
}

export interface TextRequestBody {
  input: string;
  model: string;
  profileId?: string;
  systemPrompt?: string;
  options?: Record<string, unknown>;
}

@Injectable()
export class AiService {
  @Inject()
  private readonly apiConfigService!: ApiConfigService;

  @Inject()
  private readonly logger!: Logger;

  public async describe(body: DescribeRequestBody): Promise<{ text: string }> {
    const { image, model, profileId, systemPrompt: explicitSystemPrompt, prompt, options } = body;
    const describeContext = body.context || 'service:describe';

    if (!image) {
      throw new HttpError(400, 'Missing image data');
    }

    if (!model) {
      throw new HttpError(400, 'Missing model ID');
    }

    const providers = await this.apiConfigService.getRuntimeProviders();
    const modelValidation = validateModelUsage({
      providers,
      modelId: model,
      requiredTask: 'vision',
      context: describeContext,
    });
    if (!modelValidation.valid) {
      throw new HttpError(400, 'MODEL_VALIDATION_FAILED', { code: 'MODEL_VALIDATION_FAILED', errors: modelValidation.errors });
    }

    const providerInstance = getProvider(model, undefined, providers);

    // 仅在运行时做一次特性判断
    if (!("describeImage" in providerInstance)) {
      throw new HttpError(400, `Model ${model} does not support vision tasks`);
    }

    const describeService = describeContext === 'service:datasetLabel' ? 'datasetLabel' : 'describe';
    const canUseSystemPrompt = serviceSupportsSystemPrompt(describeService, { providerId: '', modelId: model });

    let resolvedSystemPrompt = canUseSystemPrompt ? explicitSystemPrompt : undefined;
    if (canUseSystemPrompt && resolvedSystemPrompt === undefined && profileId) {
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
    const text = result.text?.trim() || '';
    if (!text) {
      const hasSystemPrompt = Boolean(resolvedSystemPrompt && resolvedSystemPrompt.trim());
      throw new HttpError(502, `Model returned empty text (hasSystemPrompt=${hasSystemPrompt})`);
    }
    return { text };
  }

  public async generateImage(body: ImageRequestBody): Promise<unknown> {
    const { prompt, model, width, height, batchSize, aspectRatio, image, images, options } = body;

    this.logger.info('ai_service_generate_image_start', {
      model,
      promptLength: prompt?.length ?? 0,
      width: width ?? null,
      height: height ?? null,
      batchSize: batchSize ?? null,
      aspectRatio: aspectRatio || null,
      imageSize: body.imageSize || null,
      hasImage: Boolean(image),
      imageCount: (images && images.length > 0) ? images.length : (image ? 1 : 0),
      streamRequested: options?.stream === true,
    });

    if (!model) {
      this.logger.warn('ai_service_generate_image_missing_model', {
        promptLength: prompt?.length ?? 0,
      });
      throw new HttpError(400, 'Missing model ID');
    }

    const providers = await this.apiConfigService.getRuntimeProviders();
    this.logger.info('ai_service_generate_image_runtime_providers_loaded', {
      model,
      providerCount: providers.length,
    });
    const modelValidation = validateModelUsage({
      providers,
      modelId: model,
      requiredTask: 'image',
      context: 'service:imageGeneration',
      imageSize: body.imageSize,
      aspectRatio,
      batchSize,
      referenceImageCount: (images && images.length > 0) ? images.length : (image ? 1 : 0),
      width,
      height,
    });
    if (!modelValidation.valid) {
      this.logger.warn('ai_service_generate_image_validation_failed', {
        model,
        imageSize: body.imageSize || null,
        aspectRatio: aspectRatio || null,
        batchSize: batchSize ?? null,
        width: width ?? null,
        height: height ?? null,
        referenceImageCount: (images && images.length > 0) ? images.length : (image ? 1 : 0),
        errors: modelValidation.errors,
      });
      throw new HttpError(400, 'MODEL_VALIDATION_FAILED', { code: 'MODEL_VALIDATION_FAILED', errors: modelValidation.errors });
    }

    const normalizedImageSize = normalizeImageSizeToken(body.imageSize) || body.imageSize;
    this.logger.info('ai_service_generate_image_params_normalized', {
      model,
      requestedImageSize: body.imageSize || null,
      normalizedImageSize: normalizedImageSize || null,
      aspectRatio: aspectRatio || null,
    });

    const providerInstance = getProvider(model, undefined, providers);
    this.logger.info('ai_service_generate_image_provider_resolved', {
      model,
      providerType: providerInstance?.constructor?.name || typeof providerInstance,
      supportsGenerateImage: 'generateImage' in providerInstance,
    });

    if (!("generateImage" in providerInstance)) {
      this.logger.warn('ai_service_generate_image_provider_missing_capability', {
        model,
        providerType: providerInstance?.constructor?.name || typeof providerInstance,
      });
      throw new HttpError(400, `Model ${model} does not support image generation`);
    }

    const params: ImageGenerationInput = {
      prompt: prompt ?? '',
      width,
      height,
      batchSize,
      aspectRatio,
      imageSize: normalizedImageSize,
      image,
      images, // 传递多张参考图
      options: {
        ...(options || {}),
        // Ensure stream is true for coze-image models if we are expecting a stream
        stream: (options?.stream as boolean | undefined) === true || model === 'coze_seed4'
      } as Record<string, unknown>,
    };

    this.logger.info('ai_service_generate_image_provider_call_start', {
      model,
      providerType: providerInstance?.constructor?.name || typeof providerInstance,
      promptLength: params.prompt?.length ?? 0,
      width: params.width ?? null,
      height: params.height ?? null,
      batchSize: params.batchSize ?? null,
      aspectRatio: params.aspectRatio || null,
      imageSize: params.imageSize || null,
      hasImage: Boolean(params.image),
      imageCount: params.images?.length ?? (params.image ? 1 : 0),
      streamRequested: params.options?.stream === true,
    });

    try {
      const result = await (providerInstance as unknown as ImageProvider).generateImage(params);
      const resultRecord = typeof result === 'object' && result !== null
        ? result as { stream?: unknown; images?: string[]; metadata?: unknown }
        : null;
      this.logger.info('ai_service_generate_image_provider_call_succeeded', {
        model,
        providerType: providerInstance?.constructor?.name || typeof providerInstance,
        hasStream: Boolean(resultRecord?.stream),
        imageCount: resultRecord?.images?.length ?? 0,
        hasMetadata: resultRecord?.metadata !== undefined,
      });
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        this.logger.error('ai_service_generate_image_provider_http_error', {
          model,
          providerType: providerInstance?.constructor?.name || typeof providerInstance,
          status: error.status,
          message: error.message,
          details: error.details ?? null,
        });
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error('ai_service_generate_image_provider_error', {
        model,
        providerType: providerInstance?.constructor?.name || typeof providerInstance,
        imageSize: normalizedImageSize || null,
        aspectRatio: aspectRatio || null,
        batchSize: batchSize ?? null,
        width: width ?? null,
        height: height ?? null,
        hasImage: Boolean(image),
        imageCount: (images && images.length > 0) ? images.length : (image ? 1 : 0),
        streamRequested: options?.stream === true,
        error: reason,
      });
      throw new HttpError(502, `Image generation failed: ${reason}`, {
        code: 'IMAGE_PROVIDER_ERROR',
        model,
        imageSize: normalizedImageSize || null,
        aspectRatio: aspectRatio || null,
      });
    }
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

    const providers = await this.apiConfigService.getRuntimeProviders();
    const modelValidation = validateModelUsage({
      providers,
      modelId: model,
      requiredTask: 'text',
      context: 'service:optimize',
    });
    if (!modelValidation.valid) {
      throw new HttpError(400, 'MODEL_VALIDATION_FAILED', { code: 'MODEL_VALIDATION_FAILED', errors: modelValidation.errors });
    }

    const providerInstance = getProvider(model, undefined, providers);

    const canUseSystemPrompt = serviceSupportsSystemPrompt('optimize', { providerId: '', modelId: model });

    let resolvedSystemPrompt = canUseSystemPrompt ? explicitSystemPrompt : undefined;
    if (canUseSystemPrompt && resolvedSystemPrompt === undefined && profileId) {
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
