import { isKvShortcutId } from "@/app/studio/playground/_lib/kv-structured-optimization";
import type { PromptOptimizationFlowKind } from "@/lib/ai/prompt-flow-taxonomy";

import type { ActiveShortcutTemplate } from "./shortcut-optimization";

export function resolvePlaygroundPromptOptimizationFlow(
  template: ActiveShortcutTemplate | null | undefined,
): Exclude<PromptOptimizationFlowKind, "canvas_text_node"> {
  if (!template) {
    return "playground_plain_text";
  }

  return isKvShortcutId(template.shortcut.id)
    ? "playground_kv_structured"
    : "playground_shortcut_inline";
}

interface DispatchPlaygroundPromptOptimizationParams {
  activeShortcutTemplate: ActiveShortcutTemplate | null | undefined;
  runKvStructuredPromptOptimization: (template: ActiveShortcutTemplate) => Promise<void>;
  runPlainTextPromptOptimization: () => Promise<void>;
  runShortcutInlinePromptOptimization: (template: ActiveShortcutTemplate) => Promise<void>;
}

export async function dispatchPlaygroundPromptOptimization({
  activeShortcutTemplate,
  runKvStructuredPromptOptimization,
  runPlainTextPromptOptimization,
  runShortcutInlinePromptOptimization,
}: DispatchPlaygroundPromptOptimizationParams): Promise<void> {
  const flowKind = resolvePlaygroundPromptOptimizationFlow(activeShortcutTemplate);

  switch (flowKind) {
    case "playground_kv_structured":
      await runKvStructuredPromptOptimization(activeShortcutTemplate as ActiveShortcutTemplate);
      return;
    case "playground_shortcut_inline":
      await runShortcutInlinePromptOptimization(activeShortcutTemplate as ActiveShortcutTemplate);
      return;
    case "playground_plain_text":
      await runPlainTextPromptOptimization();
      return;
    default: {
      const exhaustiveCheck: never = flowKind;
      throw new Error(`Unsupported playground prompt optimization flow: ${String(exhaustiveCheck)}`);
    }
  }
}
