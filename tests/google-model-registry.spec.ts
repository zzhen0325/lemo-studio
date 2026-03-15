import { afterEach, describe, expect, it } from 'vitest';
import { findProviderConfigForModel, getGoogleApiKey } from '@/lib/ai/modelRegistry';

const googleProviders = [
  {
    id: 'provider-google',
    apiKey: 'stale-provider-key',
    baseURL: '',
    providerType: 'google-genai',
    isEnabled: true,
    models: [
      {
        modelId: 'gemini-3-pro-image-preview',
      },
      {
        modelId: 'gemini-2.5-flash-image',
      },
    ],
  },
];

describe('google model registry', () => {
  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENAI_API_KEY;
  });

  it('prefers GOOGLE_GENAI_API_KEY over stored provider config', () => {
    process.env.GOOGLE_API_KEY = 'fallback-env-key';
    process.env.GOOGLE_GENAI_API_KEY = 'preferred-genai-key';

    expect(findProviderConfigForModel('gemini-3-pro-image-preview', googleProviders)?.apiKey).toBe('preferred-genai-key');
    expect(getGoogleApiKey(googleProviders)).toBe('preferred-genai-key');
  });

  it('falls back to stored provider config when google env keys are absent', () => {
    expect(findProviderConfigForModel('gemini-2.5-flash-image', googleProviders)?.apiKey).toBe('stale-provider-key');
    expect(getGoogleApiKey(googleProviders)).toBe('stale-provider-key');
  });
});
