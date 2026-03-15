import {
  MappingConfig,
  EditorSettings,
  ImportResult,
  ExportConfig,
  STORAGE_KEYS
} from "../types/features/mapping-editor";

/**
 * 本地存储管理器类
 * 负责映射配置的本地存储、导入导出等功能
 */
export class LocalStorageManager {
  private static instance: LocalStorageManager;

  private constructor() { }

  public static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }

  /**
   * 保存映射配置
   */
  async saveConfig(config: MappingConfig): Promise<string> {
    try {
      const configs = await this.getAllConfigs();
      const existingIndex = configs.findIndex(c => c.id === config.id);

      const updatedConfig = {
        ...config,
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        configs[existingIndex] = updatedConfig;
      } else {
        configs.push(updatedConfig);
      }

      localStorage.setItem(STORAGE_KEYS.MAPPING_CONFIGS, JSON.stringify(configs));

      // 更新最近使用的配置列表
      await this.updateRecentConfigs(config.id);

      return config.id;
    } catch (error) {
      console.error('保存配置失败:', error);
      throw new Error('保存配置失败');
    }
  }

  /**
   * 获取单个映射配置
   */
  async getConfig(id: string): Promise<MappingConfig | null> {
    try {
      const configs = await this.getAllConfigs();
      return configs.find(c => c.id === id) || null;
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  }

  /**
   * 获取所有映射配置
   */
  async getAllConfigs(): Promise<MappingConfig[]> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAPPING_CONFIGS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取配置列表失败:', error);
      return [];
    }
  }

  /**
   * 删除映射配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    try {
      const configs = await this.getAllConfigs();
      const filteredConfigs = configs.filter(c => c.id !== id);

      localStorage.setItem(STORAGE_KEYS.MAPPING_CONFIGS, JSON.stringify(filteredConfigs));

      // 从最近使用列表中移除
      await this.removeFromRecentConfigs(id);

      return true;
    } catch (error) {
      console.error('删除配置失败:', error);
      return false;
    }
  }

  /**
   * 导出配置为文件
   */
  async exportConfig(id: string, options: ExportConfig = {
    includeWorkflow: true,
    includePreview: false,
    format: "json",
    minify: false
  }): Promise<Blob> {
    try {
      const config = await this.getConfig(id);
      if (!config) {
        console.error('导出配置失败: 配置不存在，ID:', id);
        throw new Error(`配置不存在: ${id}`);
      }

      const exportData: Record<string, unknown> = { ...config } as unknown as Record<string, unknown>;

      if (!options.includeWorkflow) {
        delete exportData.workflowApiJSON;
      }

      const jsonString = options.minify
        ? JSON.stringify(exportData)
        : JSON.stringify(exportData, null, 2);

      return new Blob([jsonString], { type: 'application/json' });
    } catch (error) {
      console.error('导出配置失败:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('导出配置失败: 未知错误');
    }
  }

  /**
   * 导入配置文件
   */
  async importConfig(file: File): Promise<ImportResult> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证配置格式
      const validationResult = this.validateConfigFormat(data);
      if (!validationResult.isValid) {
        return {
          success: false,
          errors: validationResult.errors
        };
      }

      // 生成新的ID避免冲突
      const config: MappingConfig = {
        ...data,
        id: this.generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.saveConfig(config);

      return {
        success: true,
        config
      };
    } catch (error) {
      console.error('导入配置失败:', error);
      return {
        success: false,
        errors: ['文件格式错误或损坏']
      };
    }
  }

  /**
   * 导出所有配置
   */
  async exportAllConfigs(): Promise<Blob> {
    try {
      const configs = await this.getAllConfigs();
      const exportData = {
        version: "1.0",
        exportTime: new Date().toISOString(),
        configs
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      return new Blob([jsonString], { type: 'application/json' });
    } catch (error) {
      console.error('导出所有配置失败:', error);
      throw new Error('导出所有配置失败');
    }
  }

  /**
   * 获取编辑器设置
   */
  async getEditorSettings(): Promise<EditorSettings> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EDITOR_SETTINGS);
      const defaultSettings: EditorSettings = {
        autoSave: true,
        autoSaveInterval: 30,
        showGrid: true,
        snapToGrid: false,
        gridSize: 20,
        theme: "system",
        language: "zh"
      };

      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch (error) {
      console.error('获取编辑器设置失败:', error);
      return {
        autoSave: true,
        autoSaveInterval: 30,
        showGrid: true,
        snapToGrid: false,
        gridSize: 20,
        theme: "system",
        language: "zh"
      };
    }
  }

  /**
   * 保存编辑器设置
   */
  async saveEditorSettings(settings: EditorSettings): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.EDITOR_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('保存编辑器设置失败:', error);
      throw new Error('保存编辑器设置失败');
    }
  }

  /**
   * 获取最近使用的配置
   */
  async getRecentConfigs(limit: number = 10): Promise<MappingConfig[]> {
    try {
      const recentIds = this.getRecentConfigIds();
      const configs = await this.getAllConfigs();

      return recentIds
        .map(id => configs.find(c => c.id === id))
        .filter(Boolean)
        .slice(0, limit) as MappingConfig[];
    } catch (error) {
      console.error('获取最近配置失败:', error);
      return [];
    }
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.MAPPING_CONFIGS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_CONFIG);
      localStorage.removeItem(STORAGE_KEYS.RECENT_CONFIGS);
      localStorage.removeItem(STORAGE_KEYS.EDITOR_SETTINGS);
    } catch (error) {
      console.error('清除缓存失败:', error);
      throw new Error('清除缓存失败');
    }
  }

  /**
   * 获取存储使用情况
   */
  async getStorageUsage(): Promise<StorageEstimate> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }

    // 降级方案：估算当前使用的存储
    let totalSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length;
      }
    }

    return {
      usage: totalSize,
      quota: 5 * 1024 * 1024 // 假设5MB配额
    };
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 验证配置格式
   */
  private validateConfigFormat(data: unknown): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('配置数据格式错误');
      return { isValid: false, errors };
    }

    const d = data as Record<string, unknown>;

    if (!d.title || typeof d.title !== 'string') {
      errors.push('缺少配置标题');
    }

    if (!d.workflowApiJSON || typeof d.workflowApiJSON !== 'object') {
      errors.push('缺少工作流API JSON数据');
    }

    if (!d.uiConfig || typeof d.uiConfig !== 'object') {
      errors.push('缺少UI配置数据');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * 更新最近使用的配置列表
   */
  private async updateRecentConfigs(configId: string): Promise<void> {
    try {
      const recentIds = this.getRecentConfigIds();
      const filteredIds = recentIds.filter(id => id !== configId);
      const newRecentIds = [configId, ...filteredIds].slice(0, 10);

      localStorage.setItem(STORAGE_KEYS.RECENT_CONFIGS, JSON.stringify(newRecentIds));
    } catch (error) {
      console.error('更新最近配置失败:', error);
    }
  }

  /**
   * 从最近使用列表中移除配置
   */
  private async removeFromRecentConfigs(configId: string): Promise<void> {
    try {
      const recentIds = this.getRecentConfigIds();
      const filteredIds = recentIds.filter(id => id !== configId);

      localStorage.setItem(STORAGE_KEYS.RECENT_CONFIGS, JSON.stringify(filteredIds));
    } catch (error) {
      console.error('从最近配置中移除失败:', error);
    }
  }

  /**
   * 获取最近使用的配置ID列表
   */
  private getRecentConfigIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RECENT_CONFIGS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取最近配置ID失败:', error);
      return [];
    }
  }
}

// 导出单例实例
export const localStorageManager = LocalStorageManager.getInstance();