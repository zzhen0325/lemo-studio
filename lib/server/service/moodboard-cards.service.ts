import { randomUUID } from 'crypto';
import { HttpError } from '../utils/http-error';
import {
  MoodboardCardDoc, 
  PromptFieldDefinition 
} from '../db/models';
import { MoodboardCardsRepository } from '../repositories';
import { getFileUrl, uploadImageToStorage } from '@/src/storage/object-storage';

/**
 * 快捷入口创建/更新参数
 */
export interface MoodboardCardInput {
  id?: string;
  code: string;
  name: string;
  sortOrder?: number;
  isEnabled?: boolean;
  coverTitle?: string;
  coverSubtitle?: string;
  coverStorageKey?: string;
  coverUrl?: string;
  modelId?: string;
  defaultAspectRatio?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  allowModelChange?: boolean;
  promptTemplate?: string;
  promptFields?: PromptFieldDefinition[];
  promptConfig?: Record<string, unknown>;
  moodboardDescription?: string;
  examplePrompts?: string[];
  galleryOrder?: string[];
  creator?: string;
  publishStatus?: 'draft' | 'published' | 'archived';
}

/**
 * 快捷入口返回类型（带动态生成的图片 URL）
 */
export interface MoodboardCardOutput extends MoodboardCardDoc {
  coverUrlResolved?: string; // 动态解析的封面 URL
  galleryUrls?: string[]; // 动态解析的图集 URL 列表
}

type MoodboardCardGalleryItemKind = 'passthrough' | 'storage_key' | 'skip';

export interface MoodboardCardGalleryItemClassification {
  kind: MoodboardCardGalleryItemKind;
  value: string;
}

export function classifyMoodboardCardGalleryItem(raw: string | null | undefined): MoodboardCardGalleryItemClassification {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return { kind: 'skip', value: '' };
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return { kind: 'passthrough', value };
  }

  if (value.includes('/')) {
    return { kind: 'storage_key', value };
  }

  return { kind: 'passthrough', value };
}

/**
 * 快捷入口服务
 */
export class MoodboardCardsService {
  constructor(private readonly moodboardCardsRepository = new MoodboardCardsRepository()) {}

  /**
   * 获取所有启用的快捷入口（前端首页用）
   */
  public async listEnabled(): Promise<MoodboardCardOutput[]> {
    try {
      const moodboardCards = await this.moodboardCardsRepository.listEnabled();
      return Promise.all(moodboardCards.map((item: MoodboardCardDoc) => this.resolveMoodboardCardUrls(item)));
    } catch (error) {
      console.error('Failed to fetch enabled moodboard cards', error);
      throw new HttpError(500, 'Failed to fetch moodboard cards');
    }
  }

  /**
   * 获取所有快捷入口（管理后台用）
   */
  public async listAll(options?: { 
    status?: 'draft' | 'published' | 'archived';
    isEnabled?: boolean;
  }): Promise<MoodboardCardOutput[]> {
    try {
      const filter: Record<string, unknown> = {};
      if (options?.status) {
        filter.publish_status = options.status;
      }
      if (options?.isEnabled !== undefined) {
        filter.is_enabled = options.isEnabled;
      }

      const moodboardCards = await this.moodboardCardsRepository.list(filter);
      return Promise.all(moodboardCards.map((item: MoodboardCardDoc) => this.resolveMoodboardCardUrls(item)));
    } catch (error) {
      console.error('Failed to fetch all moodboard cards', error);
      throw new HttpError(500, 'Failed to fetch moodboard cards');
    }
  }

  /**
   * 根据 ID 获取快捷入口
   */
  public async getById(id: string): Promise<MoodboardCardOutput | null> {
    try {
      const moodboardCard = await this.moodboardCardsRepository.findById(id);
      if (!moodboardCard) return null;
      return this.resolveMoodboardCardUrls(moodboardCard);
    } catch (error) {
      console.error('Failed to fetch moodboard card by id', error);
      throw new HttpError(500, 'Failed to fetch moodboard card');
    }
  }

  /**
   * 根据 code 获取快捷入口
   */
  public async getByCode(code: string): Promise<MoodboardCardOutput | null> {
    try {
      const moodboardCard = await this.moodboardCardsRepository.findByCode(code);
      if (!moodboardCard) return null;
      return this.resolveMoodboardCardUrls(moodboardCard);
    } catch (error) {
      console.error('Failed to fetch moodboard card by code', error);
      throw new HttpError(500, 'Failed to fetch moodboard card');
    }
  }

  /**
   * 创建快捷入口
   */
  public async create(input: MoodboardCardInput): Promise<MoodboardCardOutput> {
    try {
      // 检查 code 是否已存在
      const existing = await this.moodboardCardsRepository.findByCode(input.code);
      if (existing) {
        throw new HttpError(400, `Moodboard card with code "${input.code}" already exists`);
      }

      const doc: Partial<MoodboardCardDoc> = {
        id: input.id || randomUUID(),
        code: input.code,
        name: input.name,
        is_enabled: input.isEnabled ?? true,
        cover_title: input.coverTitle,
        cover_subtitle: input.coverSubtitle,
        cover_storage_key: input.coverStorageKey,
        cover_url: input.coverUrl,
        model_id: input.modelId,
        default_aspect_ratio: input.defaultAspectRatio,
        default_width: input.defaultWidth,
        default_height: input.defaultHeight,
        allow_model_change: input.allowModelChange ?? true,
        prompt_template: input.promptTemplate,
        prompt_fields: input.promptFields,
        prompt_config: input.promptConfig,
        moodboard_description: input.moodboardDescription,
        example_prompts: input.examplePrompts,
        gallery_order: input.galleryOrder,
        creator: input.creator,
        publish_status: input.publishStatus ?? 'draft',
      };
      if (typeof input.sortOrder === 'number') {
        doc.sort_order = input.sortOrder;
      }

      const created = await this.moodboardCardsRepository.create(doc);
      return this.resolveMoodboardCardUrls(created);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to create moodboard card', error);
      throw new HttpError(500, 'Failed to create moodboard card');
    }
  }

  /**
   * 更新快捷入口
   */
  public async update(id: string, input: Partial<MoodboardCardInput>): Promise<MoodboardCardOutput | null> {
    try {
      const updateData: Record<string, unknown> = {};
      
      // 映射字段名（camelCase -> snake_case）
      if (input.name !== undefined) updateData.name = input.name;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;
      if (input.isEnabled !== undefined) updateData.is_enabled = input.isEnabled;
      if (input.coverTitle !== undefined) updateData.cover_title = input.coverTitle;
      if (input.coverSubtitle !== undefined) updateData.cover_subtitle = input.coverSubtitle;
      if (input.coverStorageKey !== undefined) updateData.cover_storage_key = input.coverStorageKey;
      if (input.coverUrl !== undefined) updateData.cover_url = input.coverUrl;
      if (input.modelId !== undefined) updateData.model_id = input.modelId;
      if (input.defaultAspectRatio !== undefined) updateData.default_aspect_ratio = input.defaultAspectRatio;
      if (input.defaultWidth !== undefined) updateData.default_width = input.defaultWidth;
      if (input.defaultHeight !== undefined) updateData.default_height = input.defaultHeight;
      if (input.allowModelChange !== undefined) updateData.allow_model_change = input.allowModelChange;
      if (input.promptTemplate !== undefined) updateData.prompt_template = input.promptTemplate;
      if (input.promptFields !== undefined) updateData.prompt_fields = input.promptFields;
      if (input.promptConfig !== undefined) updateData.prompt_config = input.promptConfig;
      if (input.moodboardDescription !== undefined) updateData.moodboard_description = input.moodboardDescription;
      if (input.examplePrompts !== undefined) updateData.example_prompts = input.examplePrompts;
      if (input.galleryOrder !== undefined) updateData.gallery_order = input.galleryOrder;
      if (input.creator !== undefined) updateData.creator = input.creator;
      if (input.publishStatus !== undefined) {
        updateData.publish_status = input.publishStatus;
        if (input.publishStatus === 'published') {
          updateData.published_at = new Date().toISOString();
        }
      }

      // 如果更新 code，需要检查是否冲突
      if (input.code !== undefined) {
        const existing = await this.moodboardCardsRepository.findByCode(input.code);
        if (existing && existing.id !== id) {
          throw new HttpError(400, `Moodboard card with code "${input.code}" already exists`);
        }
        updateData.code = input.code;
      }

      await this.moodboardCardsRepository.update(id, updateData);
      return this.getById(id);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to update moodboard card', error);
      throw new HttpError(500, 'Failed to update moodboard card');
    }
  }

  /**
   * 删除快捷入口
   */
  public async delete(id: string): Promise<void> {
    try {
      await this.moodboardCardsRepository.delete(id);
    } catch (error) {
      console.error('Failed to delete moodboard card', error);
      throw new HttpError(500, 'Failed to delete moodboard card');
    }
  }

  /**
   * 上传封面图
   */
  public async uploadCoverImage(
    moodboardCardId: string,
    file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }
  ): Promise<{ storageKey: string; url: string }> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `moodboard_card_${moodboardCardId}_cover_${Date.now()}.${ext}`;
      
      const storageKey = await uploadImageToStorage(
        buffer,
        fileName,
        'moodboard-cards/covers',
        file.type || 'image/png'
      );

      const url = await getFileUrl(storageKey);

      // 更新快捷入口的封面信息
      await this.moodboardCardsRepository.update(moodboardCardId, { cover_storage_key: storageKey, cover_url: url });

      return { storageKey, url };
    } catch (error) {
      console.error('Failed to upload cover image', error);
      throw new HttpError(500, 'Failed to upload cover image');
    }
  }

  /**
   * 发布快捷入口
   */
  public async publish(id: string): Promise<MoodboardCardOutput | null> {
    return this.update(id, { publishStatus: 'published' });
  }

  /**
   * 取消发布（改为草稿）
   */
  public async unpublish(id: string): Promise<MoodboardCardOutput | null> {
    return this.update(id, { publishStatus: 'draft' });
  }

  /**
   * 归档快捷入口
   */
  public async archive(id: string): Promise<MoodboardCardOutput | null> {
    return this.update(id, { publishStatus: 'archived', isEnabled: false });
  }

  /**
   * 解析快捷入口的图片 URL
   */
  private async resolveMoodboardCardUrls(moodboardCard: MoodboardCardDoc): Promise<MoodboardCardOutput> {
    const result: MoodboardCardOutput = { ...moodboardCard };

    try {
      // 解析封面图 URL
      if (moodboardCard.cover_storage_key) {
        result.coverUrlResolved = await getFileUrl(moodboardCard.cover_storage_key);
      } else if (moodboardCard.cover_url) {
        result.coverUrlResolved = moodboardCard.cover_url;
      }

      // 解析图集 URL
      if (moodboardCard.gallery_order && moodboardCard.gallery_order.length > 0) {
        const galleryUrls: string[] = [];
        for (const item of moodboardCard.gallery_order) {
          const classification = classifyMoodboardCardGalleryItem(item);
          if (classification.kind === 'skip') {
            continue;
          }

          if (classification.kind === 'passthrough') {
            galleryUrls.push(classification.value);
            continue;
          }

          try {
            const url = await getFileUrl(classification.value);
            galleryUrls.push(url);
          } catch {
            // 签名失败时保留原值，避免前端卡片无图可用。
            galleryUrls.push(classification.value);
          }
        }
        result.galleryUrls = galleryUrls;
      }
    } catch (error) {
      console.error('Failed to resolve moodboard card URLs', error);
    }

    return result;
  }

  /**
   * 批量更新排序
   */
  public async updateSortOrder(orders: Array<{ id: string; sortOrder: number }>): Promise<void> {
    try {
      for (const { id, sortOrder } of orders) {
        await this.moodboardCardsRepository.update(id, { sort_order: sortOrder });
      }
    } catch (error) {
      console.error('Failed to update sort order', error);
      throw new HttpError(500, 'Failed to update sort order');
    }
  }
}

export const classifyShortcutGalleryItem = classifyMoodboardCardGalleryItem;
