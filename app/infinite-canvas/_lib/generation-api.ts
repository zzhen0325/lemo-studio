import { buildFluxKleinWorkflow } from '@/lib/api/fluxklein-workflow';
import { runDirectComfyWorkflow } from '@/lib/comfyui/browser-client';
import { getConfiguredDirectComfyUrl, shouldUseDirectComfyUi } from '@/lib/comfyui/direct-config';
import { parseSize } from './helpers';
import { cleanupUndefined, requestJSON } from './api/shared';

interface FluxKleinPayload {
  prompt: string;
  imageSize?: string;
  batchSize?: number;
  seed?: number;
  referenceImages?: string[];
  signal?: AbortSignal;
}

interface GenerateImagePayload {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  batchSize?: number;
  seed?: number;
  referenceImages?: string[];
  signal?: AbortSignal;
}

function concatUint8Arrays(a: Uint8Array<ArrayBufferLike>, b: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

function findSubarray(data: Uint8Array<ArrayBufferLike>, part: Uint8Array<ArrayBufferLike>): number {
  outer: for (let i = 0; i <= data.length - part.length; i += 1) {
    for (let j = 0; j < part.length; j += 1) {
      if (data[i + j] !== part[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

async function runFluxKlein(payload: FluxKleinPayload): Promise<{ images: string[] }> {
  const { width, height } = parseSize(payload.imageSize);
  const directComfyUrl = getConfiguredDirectComfyUrl();

  if (shouldUseDirectComfyUi(directComfyUrl)) {
    const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
      prompt: payload.prompt,
      width,
      height,
      seed: payload.seed,
      batchSize: payload.batchSize,
      referenceImages: payload.referenceImages,
    });
    const blobs = await runDirectComfyWorkflow({
      workflow,
      viewComfy: {
        inputs: viewComfyInputs,
        textOutputEnabled: false,
      },
      comfyUrl: directComfyUrl,
    });
    const images = await Promise.all(blobs.map((blob) => blobToDataUrl(blob)));
    return { images: images.filter(Boolean) };
  }

  const response = await fetch('/api/comfy-fluxklein', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cleanupUndefined({
      prompt: payload.prompt,
      width,
      height,
      seed: payload.seed,
      batchSize: payload.batchSize,
      referenceImages: payload.referenceImages?.length ? payload.referenceImages : undefined,
    })),
    signal: payload.signal,
    credentials: 'include',
  });

  if (!response.ok || !response.body) {
    const fallback = await response.text().catch(() => '');
    throw new Error(fallback || `FluxKlein request failed with status ${response.status}`);
  }

  const separator = new TextEncoder().encode('--BLOB_SEPARATOR--');
  const mimeSeparator = new TextEncoder().encode('\r\n\r\n');
  const reader = response.body.getReader();

  let buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  const blobs: Blob[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    buffer = concatUint8Arrays(buffer, value);

    let index = findSubarray(buffer, separator);
    while (index !== -1) {
      const part = buffer.slice(0, index);
      buffer = buffer.slice(index + separator.length);

      const mimeIndex = findSubarray(part, mimeSeparator);
      if (mimeIndex > -1) {
        const mimeHeader = new TextDecoder().decode(part.slice(0, mimeIndex));
        const mime = mimeHeader.split(': ')[1]?.trim() || 'image/png';
        const bytes = part.slice(mimeIndex + mimeSeparator.length);
        blobs.push(new Blob([bytes], { type: mime }));
      }

      index = findSubarray(buffer, separator);
    }
  }

  if (buffer.length > 0) {
    const mimeIndex = findSubarray(buffer, mimeSeparator);
    if (mimeIndex > -1) {
      const mimeHeader = new TextDecoder().decode(buffer.slice(0, mimeIndex));
      const mime = mimeHeader.split(': ')[1]?.trim() || 'image/png';
      const bytes = buffer.slice(mimeIndex + mimeSeparator.length);
      blobs.push(new Blob([bytes], { type: mime }));
    }
  }

  const images = await Promise.all(blobs.map((blob) => blobToDataUrl(blob)));
  return { images: images.filter(Boolean) };
}

export async function saveImageAsset(imageBase64OrUrl: string, subdir: string): Promise<string> {
  const response = await requestJSON<{ path: string }>('/save-image', {
    method: 'POST',
    body: {
      imageBase64: imageBase64OrUrl,
      subdir,
      ext: 'png',
    },
  });
  return response.path;
}

export async function normalizeGeneratedImage(imageUrl: string): Promise<string> {
  if (!imageUrl) {
    return imageUrl;
  }

  if (imageUrl.startsWith('data:')) {
    return saveImageAsset(imageUrl, 'outputs');
  }

  return imageUrl;
}

export async function generateCanvasImage(payload: GenerateImagePayload): Promise<{ images: string[] }> {
  const referenceImages = payload.referenceImages?.filter(Boolean) || [];

  if (payload.model === 'flux_klein') {
    const fluxResult = await runFluxKlein({
      prompt: payload.prompt,
      imageSize: payload.imageSize,
      batchSize: payload.batchSize,
      seed: payload.seed,
      referenceImages,
      signal: payload.signal,
    });

    const images = await Promise.all(fluxResult.images.map((url) => normalizeGeneratedImage(url)));
    return { images };
  }

  const body = cleanupUndefined({
    model: payload.model,
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio,
    imageSize: payload.imageSize,
    batchSize: payload.batchSize,
    images: referenceImages.length ? referenceImages : undefined,
    options: cleanupUndefined({
      seed: payload.seed,
    }),
  });

  const result = await requestJSON<{ images?: string[] }>('/ai/image', {
    method: 'POST',
    body,
    signal: payload.signal,
  });

  const images = await Promise.all((result.images || []).map((url) => normalizeGeneratedImage(url)));
  return { images };
}
