export const INFINITE_CANVAS_MODELS = [
  { id: 'coze_seedream4_5', label: 'Seedream 4.5' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano banana pro' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano banana 2' },
  { id: 'flux_klein', label: 'FluxKlein' },
] as const;

export const DEFAULT_INFINITE_CANVAS_MODEL_ID = INFINITE_CANVAS_MODELS[0].id;
export const INFINITE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
export const INFINITE_IMAGE_SIZES = ['1024x1024', '896x1152', '1152x896', '768x1344', '1344x768'] as const;
export const INFINITE_BATCH_SIZES = [1, 2, 4] as const;
export const DEFAULT_INFINITE_NODE_PARAMS = {
  aspectRatio: '1:1',
  imageSize: '1024x1024',
  batchSize: 1,
} as const;

export type InfinitePanel = 'assets' | 'history' | 'flows' | 'queue';
