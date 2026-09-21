import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComfyFluxKleinService,
  shouldTranslateFluxKleinPrompt,
} from '@/lib/server/service/comfy-fluxklein.service';
import type { TranslateService } from '@/lib/server/service/translate.service';

describe('FluxKlein prompt translation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects non-English prompt text', () => {
    expect(shouldTranslateFluxKleinPrompt('一只红色的猫，电影光感')).toBe(true);
    expect(shouldTranslateFluxKleinPrompt('a red cat, cinematic light')).toBe(false);
  });

  it('prepares non-English prompts through the translate service', async () => {
    const translateTexts = vi.fn().mockResolvedValue(['a red cat, cinematic light']);
    const service = new ComfyFluxKleinService({ translateTexts } as unknown as TranslateService);

    const result = await service.prepareFluxKleinPrompt('一只红色的猫，电影光感', 'test-request');

    expect(result).toEqual({
      prompt: 'a red cat, cinematic light',
      translated: true,
    });
    expect(translateTexts).toHaveBeenCalledWith({
      texts: ['一只红色的猫，电影光感'],
      target: 'en',
      task: 'flux_klein_prompt_translation',
    });
  });

  it('keeps English prompts without calling translation', async () => {
    const translateTexts = vi.fn();
    const service = new ComfyFluxKleinService({ translateTexts } as unknown as TranslateService);

    const result = await service.prepareFluxKleinPrompt('a red cat, cinematic light');

    expect(result).toEqual({
      prompt: 'a red cat, cinematic light',
      translated: false,
    });
    expect(translateTexts).not.toHaveBeenCalled();
  });

  it('falls back to the original prompt when translation fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const translateTexts = vi.fn().mockRejectedValue(new Error('translator unavailable'));
    const service = new ComfyFluxKleinService({ translateTexts } as unknown as TranslateService);

    const result = await service.prepareFluxKleinPrompt('一只红色的猫');

    expect(result).toEqual({
      prompt: '一只红色的猫',
      translated: false,
    });
  });
});
