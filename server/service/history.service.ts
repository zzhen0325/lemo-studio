import { Inject, Injectable } from '@gulux/gulux';
import { ModelType } from '@gulux/gulux/typegoose';
import { HttpError } from '../utils/http-error';
import { Generation as GenerationEntity, ImageAsset } from '../db';
import type { Generation, GenerationConfig } from '../../types/database';
import { isValidObjectId } from '@byted/bytedmongoose';
import type { UpdateQuery } from '@byted/bytedmongoose';

export interface HistoryQuery {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
}

@Injectable()
export class HistoryService {
  @Inject(GenerationEntity)
  private generationModel!: ModelType<GenerationEntity>;

  @Inject(ImageAsset)
  private imageAssetModel!: ModelType<ImageAsset>;

  public async getHistory(query: HistoryQuery): Promise<{ history: Generation[]; total: number; hasMore: boolean }> {
    const { page, limit, projectId, userId } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    console.log('query=======',query)
    try {
      const filter: Record<string, unknown> = {};
      if (projectId && projectId !== 'null' && projectId !== 'undefined') {
        filter.projectId = projectId;
      }
      if (userId) {
        filter.userId = userId;
      }

      const total = await this.generationModel.countDocuments(filter);
      console.log('total=======',total)
      const items = await this.generationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate(['outputImageId', 'sourceImageId'])
        .lean();

      const history = items.map((item) => {
        const outputImage = item.outputImageId as unknown as { url?: string } | undefined;
        const sourceImage = item.sourceImageId as unknown as { url?: string } | undefined;
        return {
          id: String(item._id),
          userId: item.userId || 'anonymous',
          projectId: item.projectId || 'default',
          outputUrl: outputImage?.url || item.outputUrl,
          config: item.config,
          status: item.status || 'completed',
          sourceImageUrl: sourceImage?.url || item.config?.sourceImageUrl,
          createdAt: String(item.createdAt || new Date().toISOString()),
          progress: item.progress,
          progressStage: item.progressStage,
          llmResponse: item.llmResponse,
        } as Generation;
      });

      return {
        history,
        total,
        hasMore: (pageNum - 1) * limitNum + history.length < total,
      };
    } catch (error) {
      console.error('Failed to load history:', error);
      throw new HttpError(500, 'Failed to load history');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async saveHistory(body: any): Promise<{ success: true }> {
    try {
      if (body.action === 'batch-update' && Array.isArray(body.items)) {
        const items = body.items as Generation[];
        for (const item of items) {
          if (!item.id || !isValidObjectId(item.id)) continue;
          await this.generationModel.updateOne({ _id: item.id }, { $set: { ...item, outputUrl: item.outputUrl } });
        }
        return { success: true };
      }

      const item = body as Generation;
      if (!item || (!item.outputUrl && !item.id)) {
        throw new HttpError(400, 'Invalid item');
      }

      const cfg = (item.config || {}) as GenerationConfig;

      const record = {
        prompt: cfg.prompt || '',
        width: cfg.width,
        height: cfg.height,
        model: cfg.model,
        lora: cfg.lora,
        loras: cfg.loras,
        seed: cfg.seed,
        resolution: cfg.resolution,
        aspectRatio: cfg.aspectRatio,
        sizeFrom: cfg.sizeFrom,
        presetName: cfg.presetName,
        status: item.status || 'completed',
        progress: item.progress,
        progressStage: item.progressStage,
        userId: item.userId || 'anonymous',
        projectId: item.projectId || 'default',
        llmResponse: item.llmResponse,
        config: item.config,
        createdAt: item.createdAt || new Date().toISOString(),
        outputUrl: item.outputUrl,
      };

      const existing =
        item.id && isValidObjectId(item.id)
          ? await this.generationModel.findById(item.id)
          : item.outputUrl
            ? await this.generationModel.findOne({ outputUrl: item.outputUrl })
            : null;

      if (existing) {
        await this.generationModel.updateOne(
          { _id: existing._id },
          { $set: record } as UpdateQuery<GenerationEntity>,
        );
      } else {
        const newDoc = await this.generationModel.create(record);
        if (item.outputUrl) {
          await this.imageAssetModel.updateOne(
            { url: item.outputUrl },
            { $set: { type: 'generation', generationId: String(newDoc._id) } },
            { upsert: true },
          );
          const outputImage = await this.imageAssetModel.findOne({ url: item.outputUrl });
          await this.generationModel.updateOne({ _id: newDoc._id }, { outputImageId: outputImage?._id });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to save history item:', error);
      if (error instanceof HttpError) throw error;
      throw new HttpError(500, 'Failed to save history item');
    }
  }
}
