import {
  extractShortcutTemplateTokens,
  type ShortcutPromptFieldDefinition,
} from '@/config/moodboard-cards';

const DISABLED_SPARKLE_SHORTCUT_IDS = new Set(['lemo', 'uskv', 'seakv', 'jpkv']);

export function normalizeSparkleShortcutId(shortcutId?: string | null): string {
  return (shortcutId || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function shouldShowMoodboardPromptSparkle(shortcutId?: string | null): boolean {
  if (!shortcutId) {
    return true;
  }

  return !DISABLED_SPARKLE_SHORTCUT_IDS.has(normalizeSparkleShortcutId(shortcutId));
}

export function normalizePromptFieldDrafts(
  fields: ShortcutPromptFieldDefinition[],
): ShortcutPromptFieldDefinition[] {
  return fields.map((field, index) => ({
    key: (field.key || '').trim(),
    label: (field.label || '').trim(),
    placeholder: (field.placeholder || '').trim(),
    type: field.type || 'text',
    defaultValue: field.defaultValue ?? '',
    required: Boolean(field.required),
    options: Array.isArray(field.options)
      ? field.options.map((option) => option.trim()).filter(Boolean)
      : [],
    order: index,
  }));
}

export function normalizePromptTemplateDraftForSave(
  template: string,
  existingFields: ShortcutPromptFieldDefinition[],
) {
  const promptTemplate = template.trim();
  if (!promptTemplate) {
    return {
      promptTemplate: '',
      promptFields: [],
      missingDefinitions: [],
      unusedFields: [],
    };
  }

  const promptFields = normalizePromptFieldDrafts(existingFields);
  const templateTokens = extractShortcutTemplateTokens(promptTemplate);
  const fieldKeys = promptFields.map((field) => field.key);

  return {
    promptTemplate,
    promptFields,
    missingDefinitions: templateTokens.filter((token) => !fieldKeys.includes(token)),
    unusedFields: fieldKeys.filter((key) => !templateTokens.includes(key)),
  };
}

export function syncPromptFieldsWithTemplate(
  template: string,
  existingFields: ShortcutPromptFieldDefinition[],
): ShortcutPromptFieldDefinition[] {
  const tokens = extractShortcutTemplateTokens(template);
  if (tokens.length === 0) {
    return [];
  }

  const normalizedExisting = normalizePromptFieldDrafts(existingFields)
    .filter((field) => Boolean(field.key));
  const fieldByKey = new Map(normalizedExisting.map((field) => [field.key, field]));

  return tokens.map((token, index) => {
    const existingField = fieldByKey.get(token);
    if (existingField) {
      return {
        ...existingField,
        order: index,
      };
    }

    return {
      key: token,
      label: token,
      placeholder: token,
      type: 'text',
      defaultValue: '',
      required: false,
      options: [],
      order: index,
    } satisfies ShortcutPromptFieldDefinition;
  });
}
