import { Injectable } from '@gulux/gulux';
import { ComfyUIService } from '../../lib/api/comfyui-service';
import { ErrorResponseFactory } from '../../app/models/errors';
import { HttpError } from '../utils/http-error';
import { buildFluxKleinWorkflow } from '../../lib/api/fluxklein-workflow';
import type { IViewComfy } from '../../types/comfy-input';

const errorResponseFactory = new ErrorResponseFactory();

type FluxKleinBody = {
  prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  batchSize?: number;
  referenceImages?: string[];
  apiKey?: string;
  comfyUrl?: string;
};

@Injectable()
export class ComfyFluxKleinService {
  public async runFluxKleinFromBody(body: FluxKleinBody, logId?: string): Promise<ReadableStream<Uint8Array>> {
    try {
      const { workflow, viewComfyInputs } = await buildFluxKleinWorkflow({
        prompt: typeof body.prompt === 'string' ? body.prompt : '',
        width: Number(body.width) || 1024,
        height: Number(body.height) || 1024,
        seed: typeof body.seed === 'number' ? body.seed : undefined,
        batchSize: typeof body.batchSize === 'number' ? body.batchSize : undefined,
        referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : [],
      });

      const viewComfy: IViewComfy = {
        inputs: viewComfyInputs,
        textOutputEnabled: false,
      };

      const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;
      const comfyUrl = typeof body.comfyUrl === 'string' ? body.comfyUrl : undefined;

      const comfyUIService = new ComfyUIService({ apiKey, comfyUrl });
      const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
      console.log('[ComfyFluxKleinService] runWorkflow success', { logId: logId ?? '' });
      return stream as ReadableStream<Uint8Array>;
    } catch (error) {
      console.error('[ComfyFluxKleinService] runWorkflow failed', { logId: logId ?? '', error });
      const responseError = errorResponseFactory.getErrorResponse(error);
      throw new HttpError(500, responseError.errorMsg, responseError);
    }
  }
}
