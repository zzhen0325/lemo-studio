export const DEFAULT_SHORTCUT_MODEL = 'coze_seedream4_5';
export const DEFAULT_SHORTCUT_ASPECT_RATIO = '1:1';

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function normalizeShortcutCodeSegment(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'moodboard';
}

export function buildBaseShortcutCodeFromStyleId(styleId) {
  return normalizeShortcutCodeSegment(`mb-${styleId || ''}`);
}

export function resolveUniqueCode(baseCode, usedCodes) {
  let candidate = baseCode;
  let attempt = 2;
  while (usedCodes.has(candidate)) {
    candidate = `${baseCode}-${attempt}`;
    attempt += 1;
  }
  usedCodes.add(candidate);
  return candidate;
}

export function normalizeImagePaths(input) {
  const values = Array.isArray(input) ? input : [];
  const deduped = new Set();
  values.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    deduped.add(normalized);
  });
  return Array.from(deduped);
}

export function resolveStyleId(style) {
  return asNonEmptyString(style?.id) || asNonEmptyString(style?._id);
}

export function resolveStyleName(style, index = 1) {
  return asNonEmptyString(style?.name) || `Moodboard ${index}`;
}

export function resolveStylePrompt(style) {
  return asNonEmptyString(style?.prompt);
}

export function resolveStyleImagePaths(style) {
  return normalizeImagePaths(
    style?.imagePaths
      || style?.image_paths
      || style?.previewUrls
      || style?.preview_urls
      || [],
  );
}

export function buildShortcutPayloadFromStyle(options) {
  const { style, code, sortOrder, index = 1 } = options;
  const sourceStyleId = resolveStyleId(style);
  const name = resolveStyleName(style, index);
  const prompt = resolveStylePrompt(style);
  const imagePaths = resolveStyleImagePaths(style);

  return {
    code,
    name,
    sort_order: sortOrder,
    is_enabled: true,
    cover_url: imagePaths[0],
    model_id: DEFAULT_SHORTCUT_MODEL,
    default_aspect_ratio: DEFAULT_SHORTCUT_ASPECT_RATIO,
    prompt_template: prompt,
    prompt_fields: [],
    moodboard_description: prompt,
    gallery_order: imagePaths,
    prompt_config: sourceStyleId
      ? { sourceStyleId, migratedFrom: 'style_stacks' }
      : { migratedFrom: 'style_stacks' },
    publish_status: 'published',
  };
}

export function resolveSourceStyleIdFromPromptConfig(promptConfig) {
  if (!promptConfig || typeof promptConfig !== 'object') {
    return '';
  }

  const sourceStyleId = promptConfig.sourceStyleId;
  return asNonEmptyString(sourceStyleId);
}
