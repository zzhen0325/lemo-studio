import { ErrorResponseFactory } from '../../lib/models/errors';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';
import { readJsonAsset } from '../../lib/runtime-assets';

const errorResponseFactory = new ErrorResponseFactory();

export interface LoraMetadata {
  model_name: string;
  preview_url: string;
  trainedWords: string[];
  base_model?: string;
}

@Injectable()
export class LorasService {
  public async listLoras(): Promise<LoraMetadata[]> {
    try {
      const catalog = await readJsonAsset<LoraMetadata[]>('config/loras-catalog.json');
      if (Array.isArray(catalog)) {
        return catalog;
      }
      return [];
    } catch (error) {
      console.error('处理loras数据时出错:', error);
      const errorResponse = errorResponseFactory.getErrorResponse(error);
      throw new HttpError(500, errorResponse.errorMsg, errorResponse);
    }
  }
}
