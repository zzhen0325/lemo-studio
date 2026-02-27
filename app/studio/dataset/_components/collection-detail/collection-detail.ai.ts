import { translatePromptsBatch } from './collection-detail.service';
import type {
  DatasetImage,
  TranslateLang,
} from './types';
import {
  OPTIMIZE_MAX_RETRIES,
  RETRYABLE_OPTIMIZE_STATUS,
  RETRYABLE_TRANSLATE_STATUS,
  TRANSLATE_MAX_RETRIES,
  fetchImageAsDataUrl,
  sleepWithAbort,
} from './collection-detail.utils';
import { DEFAULT_DATASET_LABEL_SYSTEM_PROMPT } from '@/lib/constants/dataset-prompts';

interface VisionResponse {
  text?: string | null;
}

interface VisionRequest {
  image: string;
  systemPrompt?: string;
  model: string;
  prompt: string;
  context?: 'service:describe' | 'service:datasetLabel';
}

export type VisionCaller = (payload: VisionRequest) => Promise<VisionResponse>;

interface RequestDatasetLabelParams {
  imageBase64: string;
  systemPrompt: string;
  modelId: string;
  callVision: VisionCaller;
}

export async function requestDatasetLabel({
  imageBase64,
  systemPrompt,
  modelId,
  callVision,
}: RequestDatasetLabelParams): Promise<string> {
  const userPrompt = '请描述这张图片';
  const resolvedSystemPrompt = systemPrompt.trim() ? systemPrompt : DEFAULT_DATASET_LABEL_SYSTEM_PROMPT;

  try {
    const primary = await callVision({
      image: imageBase64,
      systemPrompt: resolvedSystemPrompt,
      model: modelId,
      prompt: userPrompt,
      context: 'service:datasetLabel',
    });
    const primaryText = primary.text?.trim() || '';
    if (primaryText) {
      return primaryText;
    }
    throw new Error('Model returned empty text');
  } catch (error) {
    throw error;
  }
}

export function isRetryableOptimizeError(error: unknown): boolean {
  const message =
    (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes('empty text')) return true;
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch')
  ) {
    return true;
  }

  return Array.from(RETRYABLE_OPTIMIZE_STATUS).some((status) =>
    message.includes(String(status)),
  );
}

interface OptimizeWithRetryParams {
  img: DatasetImage;
  signal: AbortSignal;
  systemPrompt: string;
  modelId: string;
  callVision: VisionCaller;
}

export async function optimizeImageWithRetry({
  img,
  signal,
  systemPrompt,
  modelId,
  callVision,
}: OptimizeWithRetryParams): Promise<string> {
  const base64 = await fetchImageAsDataUrl(img.url, signal);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= OPTIMIZE_MAX_RETRIES; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await requestDatasetLabel({ imageBase64: base64, systemPrompt, modelId, callVision });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      lastError =
        error instanceof Error ? error : new Error('Optimize request failed');
      if (!isRetryableOptimizeError(error) || attempt === OPTIMIZE_MAX_RETRIES) {
        break;
      }

      await sleepWithAbort(
        600 * 2 ** attempt + Math.floor(Math.random() * 250),
        signal,
      );
    }
  }

  throw lastError || new Error('Optimize request failed');
}

export async function requestBatchTranslateWithRetry(
  texts: string[],
  targetLang: TranslateLang,
  signal: AbortSignal,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= TRANSLATE_MAX_RETRIES; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await translatePromptsBatch(texts, targetLang, signal);
      const data = await response.json().catch(
        () =>
          ({
            error: undefined,
            translatedText: undefined,
            translatedTexts: undefined,
          }) as {
            error?: string;
            translatedText?: string;
            translatedTexts?: string[];
          },
      );

      if (!response.ok) {
        const message = data.error || `Translation failed (${response.status})`;
        if (
          !RETRYABLE_TRANSLATE_STATUS.has(response.status) ||
          attempt === TRANSLATE_MAX_RETRIES
        ) {
          throw new Error(message);
        }
        await sleepWithAbort(
          500 * 2 ** attempt + Math.floor(Math.random() * 200),
          signal,
        );
        continue;
      }

      if (Array.isArray(data.translatedTexts) && data.translatedTexts.length > 0) {
        return data.translatedTexts;
      }
      if (typeof data.translatedText === 'string') {
        return [data.translatedText];
      }
      throw new Error('No translation returned');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }

      lastError =
        error instanceof Error ? error : new Error('Translation request failed');
      if (attempt === TRANSLATE_MAX_RETRIES) {
        break;
      }
      await sleepWithAbort(
        500 * 2 ** attempt + Math.floor(Math.random() * 200),
        signal,
      );
    }
  }

  throw lastError || new Error('Translation failed');
}
