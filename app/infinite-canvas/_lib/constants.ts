export const INFINITE_CANVAS_MODELS = [
  { id: 'gemini-3-pro-image-preview', label: 'Nano banana pro' },
  { id: 'flux_klein', label: 'FluxKlein' },
] as const;

export const INFINITE_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;

export const INFINITE_IMAGE_SIZES = ['1024x1024', '896x1152', '1152x896', '768x1344', '1344x768'] as const;

export const INFINITE_BATCH_SIZES = [1, 2, 4] as const;

export type InfinitePanel = 'assets' | 'history' | 'flows' | 'queue';
