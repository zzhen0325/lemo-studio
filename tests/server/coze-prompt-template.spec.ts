import { describe, expect, it } from 'vitest';

import {
  buildMoodboardPromptTemplateInstruction,
  extractCozePromptTemplate,
  sanitizeCozePromptTemplateText,
} from '@/app/api/moodboard-cards/prompt-template/_lib/coze-prompt-template';

describe('coze prompt-template helpers', () => {
  it('sanitizes code fences and keeps first segment before |||', () => {
    const raw = '```text\n第一段模板 ||| 第二段模板\n```';
    expect(sanitizeCozePromptTemplateText(raw)).toBe('第一段模板');
  });

  it('prefers expanded_prompt over other text fields', () => {
    const payload = {
      text: 'fallback text',
      data: {
        expanded_prompt: 'expanded prompt result',
      },
    };

    expect(extractCozePromptTemplate(payload)).toBe('expanded prompt result');
  });

  it('falls back through nested output fields', () => {
    const payload = {
      result: {
        output: {
          text: 'nested output text',
        },
      },
    };

    expect(extractCozePromptTemplate(payload)).toBe('nested output text');
  });

  it('builds instruction with optional context', () => {
    const instruction = buildMoodboardPromptTemplateInstruction({
      moodboardName: 'Summer Campaign',
      currentTemplate: 'old template',
    });

    expect(instruction).toContain('只输出一段 Prompt Template');
    expect(instruction).toContain('Summer Campaign');
    expect(instruction).toContain('old template');
  });
});
