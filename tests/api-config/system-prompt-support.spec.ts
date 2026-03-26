import { describe, expect, it } from 'vitest';

import { serviceSupportsSystemPrompt } from '@/lib/api-config/types';

describe('serviceSupportsSystemPrompt', () => {
  it('disables system prompts for optimize with coze-prompt', () => {
    expect(
      serviceSupportsSystemPrompt('optimize', {
        providerId: 'provider-coze',
        modelId: 'coze-prompt',
      }),
    ).toBe(false);
  });

  it('disables system prompts for describe with coze-prompt', () => {
    expect(
      serviceSupportsSystemPrompt('describe', {
        providerId: 'provider-coze',
        modelId: 'coze-prompt',
      }),
    ).toBe(false);
  });

  it('still disables system prompts for datasetLabel', () => {
    expect(
      serviceSupportsSystemPrompt('datasetLabel', {
        providerId: 'provider-coze',
        modelId: 'coze-prompt',
      }),
    ).toBe(false);
  });
});
