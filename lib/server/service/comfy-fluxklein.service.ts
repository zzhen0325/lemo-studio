import { ComfyUIService } from '../../api/comfyui-service';
import { ErrorResponseFactory } from '../../models/errors';
import { HttpError } from '../utils/http-error';
import { buildFluxKleinWorkflow } from '../../api/fluxklein-workflow';
import type { IViewComfy } from '../../../types/comfy-input';
import type { TranslateService } from './translate.service';

const errorResponseFactory = new ErrorResponseFactory();

type FluxKleinBody = {
  prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  batchSize?: number;
  referenceImages?: string[];
  apiKey?: string;
};

type PreparedFluxKleinPrompt = {
  prompt: string;
  translated: boolean;
};

const NON_ENGLISH_SCRIPT_PATTERN = /[\u00C0-\u024F\u0370-\u03FF\u0400-\u052F\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

export function shouldTranslateFluxKleinPrompt(prompt: string): boolean {
  return NON_ENGLISH_SCRIPT_PATTERN.test(prompt);
}

export class ComfyFluxKleinService {
  constructor(private readonly translateService?: TranslateService) {}

  public async preparePromptFromBody(body: { prompt?: unknown }, logId?: string): Promise<PreparedFluxKleinPrompt> {
    return this.prepareFluxKleinPrompt(typeof body.prompt === 'string' ? body.prompt : '', logId);
  }

  public async prepareFluxKleinPrompt(prompt: string, logId?: string): Promise<PreparedFluxKleinPrompt> {
    const sourcePrompt = typeof prompt === 'string' ? prompt : '';
    if (!sourcePrompt.trim() || !shouldTranslateFluxKleinPrompt(sourcePrompt)) {
      return { prompt: sourcePrompt, translated: false };
    }

    if (!this.translateService) {
      console.warn('[FluxKlein][Server] prompt_translation_skipped', {
        traceId: logId ?? '',
        reason: 'translate_service_unavailable',
      });
      return { prompt: sourcePrompt, translated: false };
    }

    try {
      const translatedTexts = await this.translateService.translateTexts({
        texts: [sourcePrompt],
        target: 'en',
        task: 'flux_klein_prompt_translation',
      });
      const translatedPrompt = translatedTexts[0]?.trim();
      if (!translatedPrompt) {
        console.warn('[FluxKlein][Server] prompt_translation_empty', { traceId: logId ?? '' });
        return { prompt: sourcePrompt, translated: false };
      }

      console.info('[FluxKlein][Server] prompt_translation_done', {
        traceId: logId ?? '',
        changed: translatedPrompt !== sourcePrompt,
      });
      return { prompt: translatedPrompt, translated: translatedPrompt !== sourcePrompt };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[FluxKlein][Server] prompt_translation_failed', {
        traceId: logId ?? '',
        reason,
      });
      return { prompt: sourcePrompt, translated: false };
    }
  }

  public async runFluxKleinFromBody(body: FluxKleinBody, logId?: string): Promise<ReadableStream<Uint8Array>> {
    try {
      const startAt = Date.now();
      console.info('[FluxKlein][Server] request_received', { traceId: logId ?? '' });
      const preparedPrompt = await this.prepareFluxKleinPrompt(
        typeof body.prompt === 'string' ? body.prompt : '',
        logId,
      );
      const buildStart = Date.now();
      const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
        prompt: preparedPrompt.prompt,
        width: Number(body.width) || 1024,
        height: Number(body.height) || 1024,
        seed: typeof body.seed === 'number' ? body.seed : undefined,
        batchSize: typeof body.batchSize === 'number' ? body.batchSize : undefined,
        referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : [],
      });
      console.info('[FluxKlein][Server] build_workflow_done', {
        traceId: logId ?? '',
        elapsedMs: Date.now() - buildStart,
        promptTranslated: preparedPrompt.translated,
      });

      const viewComfy: IViewComfy = {
        inputs: viewComfyInputs,
        textOutputEnabled: false,
      };

      const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;

      const comfyUIService = new ComfyUIService({ apiKey, traceId: logId });
      const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
      console.info('[FluxKlein][Server] request_stream_ready', {
        traceId: logId ?? '',
        elapsedMs: Date.now() - startAt,
      });
      return stream;
    } catch (error) {
      console.error('[ComfyFluxKleinService] runWorkflow failed', { logId: logId ?? '', error });
      const responseError = errorResponseFactory.getErrorResponse(error);
      throw new HttpError(500, responseError.errorMsg, responseError);
    }
  }
}
