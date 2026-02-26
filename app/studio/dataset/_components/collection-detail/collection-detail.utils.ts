import type {
  DatasetImage,
  TranslateLang,
} from './types';

export interface PromptModifier {
  id: string;
  label: string;
  text: string;
}

export const PROMPT_MODIFIERS: PromptModifier[] = [
  {
    id: 'char_name',
    label: '角色名',
    text: 'If there is a person/character in the image, they must be referred to as {name}.',
  },
  {
    id: 'exclude_fixed',
    label: '固定角色特征',
    text: 'Do not include information about the person/character that cannot be changed (e.g., race, gender, etc.), but still include attributes that can be changed (e.g., hairstyle).',
  },
  { id: 'light', label: '光照信息', text: 'Include information about lighting.' },
  { id: 'angle', label: '拍摄角度', text: 'Please provide shooting angle information.' },
  {
    id: 'comp',
    label: '构图风格',
    text: 'Include information about the composition style of the image, such as leading lines, the rule of thirds, or symmetry.',
  },
  {
    id: 'no_meta',
    label: '消除AI对话信息',
    text: 'Your response will be used by text-to-image models, so please avoid using useless meta phrases like "This image shows...", "You are viewing...", etc.',
  },
];

export const DATASET_LABEL_MODEL = 'doubao-seed-2-0-lite-260215';
export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp']);
export const UPLOAD_CONCURRENCY = 4;
export const UPLOAD_BATCH_SIZE = 12;
export const OPTIMIZE_CONCURRENCY = 4;
export const OPTIMIZE_BATCH_SIZE = 8;
export const OPTIMIZE_MAX_RETRIES = 2;
export const RETRYABLE_OPTIMIZE_STATUS = new Set([429, 500, 502, 503, 504]);
export const TRANSLATE_CONCURRENCY = 5;
export const TRANSLATE_BATCH_SIZE = 20;
export const TRANSLATE_MAX_RETRIES = 3;
export const RETRYABLE_TRANSLATE_STATUS = new Set([429, 500, 502, 503, 504]);

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  if (items.length === 0) return;

  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    },
  );

  await Promise.all(runners);
}

export async function sleepWithAbort(ms: number, signal?: AbortSignal) {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchImageAsDataUrl(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(imageUrl, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Image fetch failed (${response.status})`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) {
    throw new Error(
      `Image fetch returned non-image content (${contentType || 'unknown'})`,
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Image fetch returned empty content');
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image data'));
    reader.readAsDataURL(blob);
  });
}

export function getPromptByLang(image: DatasetImage, lang: TranslateLang): string {
  if (lang === 'en') {
    return image.promptEn || '';
  }
  return image.promptZh || '';
}

export function setPromptByLang(
  image: DatasetImage,
  lang: TranslateLang,
  value: string,
  displayLang: TranslateLang,
): DatasetImage {
  const next =
    lang === 'en' ? { ...image, promptEn: value } : { ...image, promptZh: value };
  return {
    ...next,
    prompt: getPromptByLang(next, displayLang),
  };
}

export function normalizePromptFields(
  image: DatasetImage,
  displayLang: TranslateLang,
): DatasetImage {
  const promptZh = image.promptZh ?? image.prompt ?? '';
  const promptEn = image.promptEn ?? '';
  return {
    ...image,
    promptZh,
    promptEn,
    prompt: displayLang === 'en' ? promptEn : promptZh,
  };
}
