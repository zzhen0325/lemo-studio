import { z } from 'zod';

import { getProxyAgent } from '@/lib/ai/utils';
import { buildAbsoluteSiteUrl, readLocalPublicImage } from '@/lib/ai/imageInput';
import { handleRoute, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';
import { getFileUrl } from '@/src/storage/object-storage';
import {
  buildMoodboardPromptTemplateInstruction,
  extractCozePromptTemplate,
} from './_lib/coze-prompt-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_COZE_PROMPT_RUN_URL = 'https://m5385m4ryw.coze.site/run';
const STORAGE_KEY_PREFIX = 'ljhwZthlaukjlkulzlp/';

const MoodboardPromptTemplateRequestSchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  moodboardName: z.string().optional(),
  currentTemplate: z.string().optional(),
});

function normalizeMaybeHostUrl(value: string): string | null {
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/.+/.test(value)) {
    return null;
  }
  return `https://${value}`;
}

function parseStorageKeyFromApiPath(value: string): string | null {
  try {
    const parsed = new URL(value, 'http://placeholder.local');
    if (parsed.pathname !== '/api/storage/image') {
      return null;
    }

    const key = parsed.searchParams.get('key');
    if (!key) {
      return null;
    }
    const decoded = decodeURIComponent(key);
    return decoded.startsWith(STORAGE_KEY_PREFIX) ? decoded : null;
  } catch {
    return null;
  }
}

async function resolveCozePromptImageUrl(rawImage: string): Promise<string> {
  const image = rawImage.trim();
  if (!image) {
    throw new HttpError(400, 'Image entry is empty');
  }

  if (image.startsWith('data:') || /^https?:\/\//i.test(image)) {
    return image;
  }

  if (image.startsWith('local:')) {
    throw new HttpError(400, 'local: image is not supported for server-side prompt template generation');
  }

  const hostUrl = normalizeMaybeHostUrl(image);
  if (hostUrl) {
    return hostUrl;
  }

  const storageKeyFromPath = parseStorageKeyFromApiPath(image);
  if (storageKeyFromPath) {
    return getFileUrl(storageKeyFromPath, 3600);
  }

  if (image.startsWith(STORAGE_KEY_PREFIX)) {
    return getFileUrl(image, 3600);
  }

  if (image.startsWith('/')) {
    const localImage = await readLocalPublicImage(image);
    if (localImage) {
      return `data:${localImage.mimeType};base64,${localImage.data}`;
    }

    const absolute = buildAbsoluteSiteUrl(image);
    if (absolute) {
      return absolute;
    }

    throw new HttpError(400, `Failed to resolve relative image path "${image}". Configure NEXT_PUBLIC_BASE_URL.`);
  }

  if (image.includes('/')) {
    try {
      return await getFileUrl(image, 3600);
    } catch {
      throw new HttpError(400, `Unsupported image path "${image}"`);
    }
  }

  throw new HttpError(400, `Unsupported image value "${image}"`);
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await readJsonBody<unknown>(request);
    const parsed = MoodboardPromptTemplateRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(400, 'Invalid moodboard prompt-template payload', parsed.error.flatten());
    }

    const runUrl = process.env.LEMO_COZE_PROMPT_RUN_URL?.trim() || DEFAULT_COZE_PROMPT_RUN_URL;
    const apiToken = process.env.LEMO_COZE_PROMPT_API_TOKEN?.trim() || process.env.LEMO_COZE_API_TOKEN?.trim();
    if (!apiToken) {
      throw new HttpError(500, 'LEMO_COZE_PROMPT_API_TOKEN is not set');
    }

    const normalizedImages = Array.from(
      new Set(parsed.data.images.map((item) => item.trim()).filter(Boolean)),
    ).slice(0, 4);
    if (normalizedImages.length === 0) {
      throw new HttpError(400, 'At least one valid image is required');
    }

    const resolvedImages = await Promise.all(
      normalizedImages.map((image) => resolveCozePromptImageUrl(image)),
    );

    const payload = {
      images: resolvedImages.map((url) => ({
        url,
        file_type: 'image',
      })),
      text: buildMoodboardPromptTemplateInstruction({
        moodboardName: parsed.data.moodboardName,
        currentTemplate: parsed.data.currentTemplate,
      }),
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    };
    if (agent) {
      fetchOptions.agent = agent;
    }

    const response = await fetch(runUrl, fetchOptions);
    const raw = await response.text();

    if (!response.ok) {
      const truncated = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
      throw new HttpError(502, `Coze Prompt API Error: ${response.status} - ${truncated}`);
    }

    const normalizedRaw = raw.trim();
    if (!normalizedRaw) {
      throw new HttpError(502, 'Coze Prompt API returned empty body');
    }

    let parsedPayload: unknown = normalizedRaw;
    try {
      parsedPayload = JSON.parse(normalizedRaw);
    } catch {
      parsedPayload = normalizedRaw;
    }

    const promptTemplate = extractCozePromptTemplate(parsedPayload).trim();
    if (!promptTemplate) {
      const truncated = normalizedRaw.length > 500 ? `${normalizedRaw.slice(0, 500)}...` : normalizedRaw;
      throw new HttpError(502, `Coze Prompt API returned empty prompt template: ${truncated}`);
    }

    return {
      promptTemplate,
      imageCount: resolvedImages.length,
    };
  });
}
