export const PROMPT_OPTIMIZATION_FLOW_KINDS = [
  "playground_plain_text",
  "playground_shortcut_inline",
  "playground_kv_structured",
  "canvas_text_node",
] as const;

export type PromptOptimizationFlowKind = (typeof PROMPT_OPTIMIZATION_FLOW_KINDS)[number];

export const PROMPT_ADJACENT_FLOW_KINDS = [
  "describe_image",
  "dataset_label",
  "dataset_translate",
  "moodboard_prompt_template",
  "image_edit_prompt_assembly",
] as const;

export type PromptAdjacentFlowKind = (typeof PROMPT_ADJACENT_FLOW_KINDS)[number];

// Persisted values stay stable for compatibility with existing history records.
export const PERSISTED_PROMPT_OPTIMIZATION_SOURCE_KINDS = [
  "plain_text",
  "kv_structured",
  "shortcut_inline",
] as const;

export type PersistedPromptOptimizationSourceKind =
  (typeof PERSISTED_PROMPT_OPTIMIZATION_SOURCE_KINDS)[number];

export const PROMPT_OPTIMIZATION_REQUEST_PREFIX_BY_FLOW_KIND: Record<
  PromptOptimizationFlowKind,
  "[Event kv]" | "[Text]"
> = {
  playground_plain_text: "[Text]",
  playground_shortcut_inline: "[Text]",
  playground_kv_structured: "[Event kv]",
  canvas_text_node: "[Text]",
};

export function isPromptOptimizationFlowKind(value: string): value is PromptOptimizationFlowKind {
  return (PROMPT_OPTIMIZATION_FLOW_KINDS as readonly string[]).includes(value);
}

export function isPromptAdjacentFlowKind(value: string): value is PromptAdjacentFlowKind {
  return (PROMPT_ADJACENT_FLOW_KINDS as readonly string[]).includes(value);
}

export function isPersistedPromptOptimizationSourceKind(
  value: string,
): value is PersistedPromptOptimizationSourceKind {
  return (PERSISTED_PROMPT_OPTIMIZATION_SOURCE_KINDS as readonly string[]).includes(value);
}

export function getPromptOptimizationRequestPrefix(
  flowKind: PromptOptimizationFlowKind,
): "[Event kv]" | "[Text]" {
  return PROMPT_OPTIMIZATION_REQUEST_PREFIX_BY_FLOW_KIND[flowKind];
}

export function tagPromptOptimizationInput(
  input: string,
  flowKind: PromptOptimizationFlowKind,
): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return "";
  }

  return `${getPromptOptimizationRequestPrefix(flowKind)}\n${trimmedInput}`;
}

export const PROMPT_OPTIMIZATION_SOURCE_KIND_TO_FLOW_KIND: Record<
  PersistedPromptOptimizationSourceKind,
  Exclude<PromptOptimizationFlowKind, "canvas_text_node">
> = {
  plain_text: "playground_plain_text",
  kv_structured: "playground_kv_structured",
  shortcut_inline: "playground_shortcut_inline",
};
