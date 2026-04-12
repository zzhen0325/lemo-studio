import { describe, expect, it } from 'vitest';

import {
  PROMPT_OPTIMIZATION_SOURCE_KIND_TO_FLOW_KIND,
  getPromptOptimizationRequestPrefix,
  isPromptAdjacentFlowKind,
  isPromptOptimizationFlowKind,
  tagPromptOptimizationInput,
} from '@/lib/ai/prompt-flow-taxonomy';

describe('prompt flow taxonomy', () => {
  it('keeps dataset label outside prompt optimization flows', () => {
    expect(isPromptOptimizationFlowKind('dataset_label')).toBe(false);
    expect(isPromptAdjacentFlowKind('dataset_label')).toBe(true);
  });

  it('maps persisted optimization source kinds back to playground business flows', () => {
    expect(PROMPT_OPTIMIZATION_SOURCE_KIND_TO_FLOW_KIND.plain_text).toBe('playground_plain_text');
    expect(PROMPT_OPTIMIZATION_SOURCE_KIND_TO_FLOW_KIND.kv_structured).toBe('playground_kv_structured');
    expect(PROMPT_OPTIMIZATION_SOURCE_KIND_TO_FLOW_KIND.shortcut_inline).toBe('playground_shortcut_inline');
  });

  it('uses the KV request tag only for structured KV optimization', () => {
    expect(getPromptOptimizationRequestPrefix('playground_kv_structured')).toBe('[Event kv]');
    expect(getPromptOptimizationRequestPrefix('playground_plain_text')).toBe('[Text]');
    expect(getPromptOptimizationRequestPrefix('canvas_text_node')).toBe('[Text]');
  });

  it('tags text optimization input without changing the original payload body', () => {
    expect(
      tagPromptOptimizationInput('一只猫坐在桌子上', 'playground_plain_text'),
    ).toBe('[Text]\n一只猫坐在桌子上');

    expect(
      tagPromptOptimizationInput('Create a US-EVENT KV ...', 'playground_kv_structured'),
    ).toBe('[Event kv]\nCreate a US-EVENT KV ...');
  });
});
