import { ComfyUIService } from '../../api/comfyui-service';
import { ErrorResponseFactory } from '../../models/errors';
import { HttpError } from '../utils/http-error';
import type { IViewComfy } from '../../../types/comfy-input';

const errorResponseFactory = new ErrorResponseFactory();

export class ComfyService {
  public async runWorkflowFromFormData(formData: FormData, logId?: string): Promise<ReadableStream<Uint8Array>> {
    let workflow: object | undefined;
    const workflowStr = formData.get('workflow');
    if (workflowStr && workflowStr !== 'undefined') {
      workflow = JSON.parse(workflowStr as string);
    }

    let viewComfy: IViewComfy | undefined = { inputs: [], textOutputEnabled: false };
    const viewComfyStr = formData.get('viewComfy');
    if (viewComfyStr && viewComfyStr !== 'undefined') {
      viewComfy = JSON.parse(viewComfyStr as string) as IViewComfy;
    }

    if (!viewComfy) {
      throw new HttpError(400, 'viewComfy is required');
    }

    try {
      const apiKey = formData.get('apiKey') as string | undefined;

      const comfyUIService = new ComfyUIService({ apiKey });
      const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
      return stream as ReadableStream<Uint8Array>;
    } catch (error) {
      console.error('[ComfyService] runWorkflow failed', { logId: logId ?? '', error });
      const responseError = errorResponseFactory.getErrorResponse(error);
      throw new HttpError(500, responseError.errorMsg, responseError);
    }
  }
}
