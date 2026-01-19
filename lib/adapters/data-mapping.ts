import {
  AspectRatio,
  Resolution,
  GenerationConfig,
} from '@/types/database';

const AR_MAP: Record<Exclude<AspectRatio, 'auto'>, Record<Resolution, { w: number; h: number }>> = {
  '1:1': { '1K': { w: 1024, h: 1024 }, '2K': { w: 2048, h: 2048 }, '4K': { w: 4096, h: 4096 } },
  '2:3': { '1K': { w: 848, h: 1264 }, '2K': { w: 1696, h: 2528 }, '4K': { w: 3392, h: 5056 } },
  '3:2': { '1K': { w: 1264, h: 848 }, '2K': { w: 2528, h: 1696 }, '4K': { w: 5056, h: 3392 } },
  '3:4': { '1K': { w: 896, h: 1200 }, '2K': { w: 1792, h: 2400 }, '4K': { w: 3584, h: 4800 } },
  '4:3': { '1K': { w: 1200, h: 896 }, '2K': { w: 2400, h: 1792 }, '4K': { w: 4800, h: 3584 } },
  '4:5': { '1K': { w: 928, h: 1152 }, '2K': { w: 1856, h: 2304 }, '4K': { w: 3712, h: 4608 } },
  '5:4': { '1K': { w: 1152, h: 928 }, '2K': { w: 2304, h: 1856 }, '4K': { w: 4608, h: 3712 } },
  '9:16': { '1K': { w: 768, h: 1376 }, '2K': { w: 1536, h: 2752 }, '4K': { w: 3072, h: 5504 } },
  '16:9': { '1K': { w: 1376, h: 768 }, '2K': { w: 2752, h: 1536 }, '4K': { w: 5504, h: 3072 } },
  '21:9': { '1K': { w: 1584, h: 672 }, '2K': { w: 3168, h: 1344 }, '4K': { w: 6336, h: 2688 } },
};

export const RATIO_BASED_MODELS = new Set<string>(['gemini-3-pro-image-preview', 'seed4_2_lemo', 'coze_seed4']);

export function deriveSize(aspectRatio: Exclude<AspectRatio, 'auto'>, resolution: Resolution) {
  const pair = AR_MAP[aspectRatio][resolution];
  return { width: pair.w, height: pair.h };
}

export function inferRatioResolution(width: number, height: number) {
  let best: { aspectRatio: Exclude<AspectRatio, 'auto'>; resolution: Resolution; w: number; h: number; diff: number } | null = null;
  const resolutions: Resolution[] = ['1K', '2K', '4K'];
  const ratios = Object.keys(AR_MAP) as Exclude<AspectRatio, 'auto'>[];
  for (const ar of ratios) {
    for (const res of resolutions) {
      if (!AR_MAP[ar] || !AR_MAP[ar][res]) continue;
      const { w, h } = AR_MAP[ar][res];
      const diff = Math.abs(w - width) + Math.abs(h - height);
      if (!best || diff < best.diff) best = { aspectRatio: ar, resolution: res, w, h, diff };
    }
  }
  if (!best) return null;
  return { aspectRatio: best.aspectRatio, resolution: best.resolution };
}

export function toUnifiedConfigFromLegacy(input: GenerationConfig): GenerationConfig {
  let model = input.model;
  const width = Number(input.width);
  const height = Number(input.height);

  // Backward compatibility for legacy model names
  if (model === 'Nano banana' || model === 'nanobanana') {
    model = 'gemini-3-pro-image-preview';
  } else if (model === 'Seed 4.2' || model === '3D Lemo Seed_4' || model === 'Seed4 ') {
    model = 'seed4_2_lemo';
  } else if (model === 'Seed 4.0') {
    model = 'seed4_lemo1230';
  } else if (model === 'Seed 3' || model === '3D Lemo seed3') {
    model = 'lemo_2dillustator';
  } else if (model === 'Seed 4') {
    model = 'lemoseedt2i';
  }

  if (model && RATIO_BASED_MODELS.has(model)) {
    const inferred = inferRatioResolution(width, height);
    let resolution = input.resolution || inferred?.resolution;

    // Default to 2K for Seed 4.2 if no resolution specified
    if (model === 'seed4_2_lemo' && !input.resolution) {
      resolution = '2K';
    }

    const aspectRatio: AspectRatio = input.aspectRatio || inferred?.aspectRatio || '1:1';
    if (aspectRatio === 'auto') {
      return {
        ...input,
        prompt: input.prompt,
        width,
        height,
        model,
        resolution: resolution || '1K',
        aspectRatio: 'auto',
        sizeFrom: 'custom',
      };
    }

    if (resolution && aspectRatio) {
      const size = deriveSize(aspectRatio as Exclude<AspectRatio, 'auto'>, resolution);
      return {
        ...input,
        prompt: input.prompt,
        width: size.width,
        height: size.height,
        model,
        resolution,
        aspectRatio,
        sizeFrom: 'ratioResolution',
      };
    }
    return {
      ...input,
      prompt: input.prompt,
      width,
      height,
      model,
      sizeFrom: 'custom',
    };
  }
  return {
    ...input,
    prompt: input.prompt,
    width,
    height,
    model,
  };
}

