/**
 * Centralised mapping from internal model id to the user-facing display name
 * shown in dropdowns (e.g. the playground model selector).
 *
 * The gallery Filters panel uses this helper to render the same display name
 * that users see in the model dropdown, instead of the raw id stored in
 * history records (e.g. `coze_seedream4_5` -> `Seedream 4.5`).
 */

export const MODEL_DISPLAY_NAME_MAP: Record<string, string> = {
  coze_seedream4_5: 'Seedream 4.5',
  seed4_0916_lemo: 'Lemo Seed',
  // 历史记录里仍可能存在的 v2 内部 id，归一化到同一个 Lemo Seed 展示名。
  seed4_v2_0226lemo: 'Lemo Seed',
  seed4_2_lemo: 'Lemo Seed',
  flux_klein: 'FluxKlein',
};

export function getModelDisplayName(modelId: string | null | undefined): string {
  if (!modelId) {
    return 'Unknown Model';
  }

  return MODEL_DISPLAY_NAME_MAP[modelId] ?? modelId;
}

export function isKnownModelId(modelId: string | null | undefined): boolean {
  if (!modelId) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(MODEL_DISPLAY_NAME_MAP, modelId);
}
