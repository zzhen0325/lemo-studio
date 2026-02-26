import { translatePromptsBatch } from '@/components/features/dataset/collection-detail/collection-detail.service';
import type {
  DatasetImage,
  TranslateLang,
} from '@/components/features/dataset/collection-detail/types';
import {
  DATASET_LABEL_MODEL,
  OPTIMIZE_MAX_RETRIES,
  RETRYABLE_OPTIMIZE_STATUS,
  RETRYABLE_TRANSLATE_STATUS,
  TRANSLATE_MAX_RETRIES,
  fetchImageAsDataUrl,
  sleepWithAbort,
} from '@/components/features/dataset/collection-detail/collection-detail.utils';

interface VisionResponse {
  text?: string | null;
}

interface VisionRequest {
  image: string;
  systemPrompt?: string;
  model: string;
  prompt: string;
}

export type VisionCaller = (payload: VisionRequest) => Promise<VisionResponse>;

interface RequestDatasetLabelParams {
  imageBase64: string;
  systemPrompt: string;
  callVision: VisionCaller;
}

export async function requestDatasetLabel({
  imageBase64,
  systemPrompt,
  callVision,
}: RequestDatasetLabelParams): Promise<string> {
  const userPrompt = '请描述这张图片';
  let primaryError: unknown = null;

  try {
    const primary = await callVision({
      image: imageBase64,
      systemPrompt: systemPrompt || undefined,
      model: DATASET_LABEL_MODEL,
      prompt: userPrompt,
    });
    const primaryText = primary.text?.trim() || '';
    if (primaryText) {
      return primaryText;
    }
  } catch (error) {
    primaryError = error;
  }

  if (systemPrompt.trim()) {
    try {
      const fallback = await callVision({
        image: imageBase64,
        model: DATASET_LABEL_MODEL,
        prompt: userPrompt,
      });
      const fallbackText = fallback.text?.trim() || '';
      if (fallbackText) {
        console.warn('[dataset] optimize fallback succeeded without systemPrompt');
        return fallbackText;
      }
    } catch (fallbackError) {
      const fallbackMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      if (primaryError) {
        const primaryMsg =
          primaryError instanceof Error ? primaryError.message : String(primaryError);
        throw new Error(`${primaryMsg}; fallback failed: ${fallbackMsg}`);
      }
      throw fallbackError;
    }

    if (primaryError) {
      throw primaryError;
    }
    throw new Error('Model returned empty text (with and without systemPrompt)');
  }

  if (primaryError) {
    throw primaryError;
  }
  throw new Error('Model returned empty text');
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
  callVision: VisionCaller;
}

export async function optimizeImageWithRetry({
  img,
  signal,
  systemPrompt,
  callVision,
}: OptimizeWithRetryParams): Promise<string> {
  const base64 = await fetchImageAsDataUrl(img.url, signal);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= OPTIMIZE_MAX_RETRIES; attempt += 1) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await requestDatasetLabel({ imageBase64: base64, systemPrompt, callVision });
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
