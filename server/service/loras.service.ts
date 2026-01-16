import path from 'node:path';
import fs from 'node:fs/promises';
import { ErrorResponseFactory } from '../../app/models/errors';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

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
      const lorasDir = path.join(process.cwd(), 'public', 'loras');
      const files = await fs.readdir(lorasDir);
      const metadataFiles = files.filter((file) => file.endsWith('.metadata.json'));

      const lorasData: LoraMetadata[] = [];

      for (const metadataFile of metadataFiles) {
        try {
          const metadataPath = path.join(lorasDir, metadataFile);
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent) as any;

          const modelName = metadataFile.replace('.metadata.json', '') + '.safetensors';

          const webpFileName = metadataFile.replace('.metadata.json', '') + '.webp';
          const webpFilePath = path.join(lorasDir, webpFileName);
          let previewUrl = '';
          if (await this.fileExists(webpFilePath)) {
            previewUrl = `/loras/${webpFileName}`;
          }

          let trainedWords: string[] = [];
          if (metadata.civitai && metadata.civitai.trainedWords) {
            trainedWords = Array.isArray(metadata.civitai.trainedWords)
              ? metadata.civitai.trainedWords
              : [metadata.civitai.trainedWords];
          }

          const baseModel = typeof metadata.base_model === 'string' ? metadata.base_model : '';
          lorasData.push({
            model_name: modelName,
            preview_url: previewUrl,
            trainedWords,
            base_model: baseModel,
          });
        } catch (err) {
          console.error(`处理文件 ${metadataFile} 时出错:`, err);
        }
      }

      return lorasData;
    } catch (error) {
      console.error('处理loras数据时出错:', error);
      const errorResponse = errorResponseFactory.getErrorResponse(error);
      throw new HttpError(500, errorResponse.errorMsg, errorResponse);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
