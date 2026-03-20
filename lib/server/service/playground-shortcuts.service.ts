import { randomUUID } from 'crypto';
import { HttpError } from '../utils/http-error';
import { 
  PlaygroundShortcutModel, 
  PlaygroundShortcutDoc, 
  PromptFieldDefinition 
} from '../db/models';
import { getFileUrl, uploadImageToStorage } from '@/src/storage/object-storage';

/**
 * 快捷入口创建/更新参数
 */
export interface PlaygroundShortcutInput {
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
export interface PlaygroundShortcutOutput extends PlaygroundShortcutDoc {
  coverUrlResolved?: string; // 动态解析的封面 URL
  galleryUrls?: string[]; // 动态解析的图集 URL 列表
}

/**
 * 快捷入口服务
 */
export class PlaygroundShortcutsService {
  /**
   * 获取所有启用的快捷入口（前端首页用）
   */
  public async listEnabled(): Promise<PlaygroundShortcutOutput[]> {
    try {
      const shortcuts = await PlaygroundShortcutModel.findEnabled();
      return Promise.all(shortcuts.map((s: PlaygroundShortcutDoc) => this.resolveShortcutUrls(s)));
    } catch (error) {
      console.error('Failed to fetch enabled shortcuts', error);
      throw new HttpError(500, 'Failed to fetch shortcuts');
    }
  }

  /**
   * 获取所有快捷入口（管理后台用）
   */
  public async listAll(options?: { 
    status?: 'draft' | 'published' | 'archived';
    isEnabled?: boolean;
  }): Promise<PlaygroundShortcutOutput[]> {
    try {
      const filter: Record<string, unknown> = {};
      if (options?.status) {
        filter.publish_status = options.status;
      }
      if (options?.isEnabled !== undefined) {
        filter.is_enabled = options.isEnabled;
      }

      const shortcuts = await PlaygroundShortcutModel.find(filter)
        .sort({ sort_order: 1 })
        .lean();
      
      return Promise.all(shortcuts.map((s: PlaygroundShortcutDoc) => this.resolveShortcutUrls(s)));
    } catch (error) {
      console.error('Failed to fetch all shortcuts', error);
      throw new HttpError(500, 'Failed to fetch shortcuts');
    }
  }

  /**
   * 根据 ID 获取快捷入口
   */
  public async getById(id: string): Promise<PlaygroundShortcutOutput | null> {
    try {
      const shortcut = await PlaygroundShortcutModel.findById(id);
      if (!shortcut) return null;
      return this.resolveShortcutUrls(shortcut);
    } catch (error) {
      console.error('Failed to fetch shortcut by id', error);
      throw new HttpError(500, 'Failed to fetch shortcut');
    }
  }

  /**
   * 根据 code 获取快捷入口
   */
  public async getByCode(code: string): Promise<PlaygroundShortcutOutput | null> {
    try {
      const shortcut = await PlaygroundShortcutModel.findByCode(code);
      if (!shortcut) return null;
      return this.resolveShortcutUrls(shortcut);
    } catch (error) {
      console.error('Failed to fetch shortcut by code', error);
      throw new HttpError(500, 'Failed to fetch shortcut');
    }
  }

  /**
   * 创建快捷入口
   */
  public async create(input: PlaygroundShortcutInput): Promise<PlaygroundShortcutOutput> {
    try {
      // 检查 code 是否已存在
      const existing = await PlaygroundShortcutModel.findByCode(input.code);
      if (existing) {
        throw new HttpError(400, `Shortcut with code "${input.code}" already exists`);
      }

      const doc: Partial<PlaygroundShortcutDoc> = {
        id: input.id || randomUUID(),
        code: input.code,
        name: input.name,
        sort_order: input.sortOrder ?? 0,
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

      const created = await PlaygroundShortcutModel.create(doc);
      return this.resolveShortcutUrls(created);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to create shortcut', error);
      throw new HttpError(500, 'Failed to create shortcut');
    }
  }

  /**
   * 更新快捷入口
   */
  public async update(id: string, input: Partial<PlaygroundShortcutInput>): Promise<PlaygroundShortcutOutput | null> {
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
        const existing = await PlaygroundShortcutModel.findByCode(input.code);
        if (existing && existing.id !== id) {
          throw new HttpError(400, `Shortcut with code "${input.code}" already exists`);
        }
        updateData.code = input.code;
      }

      await PlaygroundShortcutModel.updateOne({ id }, { $set: updateData });
      return this.getById(id);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Failed to update shortcut', error);
      throw new HttpError(500, 'Failed to update shortcut');
    }
  }

  /**
   * 删除快捷入口
   */
  public async delete(id: string): Promise<void> {
    try {
      await PlaygroundShortcutModel.deleteOne({ id });
    } catch (error) {
      console.error('Failed to delete shortcut', error);
      throw new HttpError(500, 'Failed to delete shortcut');
    }
  }

  /**
   * 上传封面图
   */
  public async uploadCoverImage(
    shortcutId: string,
    file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> }
  ): Promise<{ storageKey: string; url: string }> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `shortcut_${shortcutId}_cover_${Date.now()}.${ext}`;
      
      const storageKey = await uploadImageToStorage(
        buffer,
        fileName,
        'playground-shortcuts/covers',
        file.type || 'image/png'
      );

      const url = await getFileUrl(storageKey);

      // 更新快捷入口的封面信息
      await PlaygroundShortcutModel.updateOne(
        { id: shortcutId },
        { $set: { cover_storage_key: storageKey, cover_url: url } }
      );

      return { storageKey, url };
    } catch (error) {
      console.error('Failed to upload cover image', error);
      throw new HttpError(500, 'Failed to upload cover image');
    }
  }

  /**
   * 发布快捷入口
   */
  public async publish(id: string): Promise<PlaygroundShortcutOutput | null> {
    return this.update(id, { publishStatus: 'published' });
  }

  /**
   * 取消发布（改为草稿）
   */
  public async unpublish(id: string): Promise<PlaygroundShortcutOutput | null> {
    return this.update(id, { publishStatus: 'draft' });
  }

  /**
   * 归档快捷入口
   */
  public async archive(id: string): Promise<PlaygroundShortcutOutput | null> {
    return this.update(id, { publishStatus: 'archived', isEnabled: false });
  }

  /**
   * 解析快捷入口的图片 URL
   */
  private async resolveShortcutUrls(shortcut: PlaygroundShortcutDoc): Promise<PlaygroundShortcutOutput> {
    const result: PlaygroundShortcutOutput = { ...shortcut };

    try {
      // 解析封面图 URL
      if (shortcut.cover_storage_key) {
        result.coverUrlResolved = await getFileUrl(shortcut.cover_storage_key);
      } else if (shortcut.cover_url) {
        result.coverUrlResolved = shortcut.cover_url;
      }

      // 解析图集 URL
      if (shortcut.gallery_order && shortcut.gallery_order.length > 0) {
        // gallery_order 存储的是 image asset IDs，需要查询对应的 storage_key
        // 这里简化处理，如果 gallery_order 直接存储的是 storage_key 则生成 URL
        // 否则需要关联查询 image_assets 表
        const galleryUrls: string[] = [];
        for (const item of shortcut.gallery_order) {
          // 判断是否是 storage_key（通常包含 "/"）
          if (item.includes('/')) {
            const url = await getFileUrl(item);
            galleryUrls.push(url);
          }
        }
        result.galleryUrls = galleryUrls;
      }
    } catch (error) {
      console.error('Failed to resolve shortcut URLs', error);
    }

    return result;
  }

  /**
   * 批量更新排序
   */
  public async updateSortOrder(orders: Array<{ id: string; sortOrder: number }>): Promise<void> {
    try {
      for (const { id, sortOrder } of orders) {
        await PlaygroundShortcutModel.updateOne({ id }, { $set: { sort_order: sortOrder } });
      }
    } catch (error) {
      console.error('Failed to update sort order', error);
      throw new HttpError(500, 'Failed to update sort order');
    }
  }
}
