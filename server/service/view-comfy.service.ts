import path from 'path';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';
import { readJsonAsset } from '../../lib/runtime-assets';
import { uploadTextAssetToRuntimeCdn } from '../utils/runtime-cdn-manifest';
import {
  createGovernedWorkflowEntry,
  governWorkflowIndex,
  type WorkflowIndexData,
  type WorkflowIndexItem,
} from '../../lib/workflow-governance';

export interface ViewComfyConfigPayload {
  appTitle: string;
  appImg: string;
  viewComfys: Record<string, unknown>[];
}

@Injectable()
export class ViewComfyConfigService {
  private getLegacyFallbackPaths() {
    return [
      path.posix.join('config', 'legacy', 'view_comfy.json'),
    ];
  }

  private getWorkflowsDir() {
    return 'workflows';
  }

  private getIndexPath() {
    return path.posix.join(this.getWorkflowsDir(), 'index.json');
  }

  private getWorkflowFiles(folder: string) {
    const normalizedFolder = folder.replace(/\\/g, '/');
    return {
      configPath: path.posix.join(this.getWorkflowsDir(), normalizedFolder, 'config.json'),
      workflowApiPath: path.posix.join(this.getWorkflowsDir(), normalizedFolder, 'workflow.json'),
    };
  }

  private async readGovernedIndex(): Promise<WorkflowIndexData> {
    const parsed = await readJsonAsset<WorkflowIndexData>(this.getIndexPath());
    const { normalized, changed, issues } = governWorkflowIndex(parsed);

    if (issues.length > 0) {
      for (const issue of issues) {
        const method = issue.level === 'error' ? 'error' : 'warn';
        console[method](`[ViewComfyService][${issue.code}] ${issue.message}`);
      }
    }

    if (changed) {
      console.warn('[ViewComfyService] workflow index needed normalization. Re-run CDN migration to persist the governed index.');
    }

    return normalized;
  }

  public async getConfig(lightweight: boolean = false): Promise<unknown> {
    try {
      const indexData = await this.readGovernedIndex();

      const viewComfys: Record<string, unknown>[] = [];
      for (const workflow of indexData.workflows) {
        const { configPath, workflowApiPath } = this.getWorkflowFiles(workflow.folder);

        try {
          if (lightweight) {
            const config = await readJsonAsset<Record<string, unknown>>(configPath);
            viewComfys.push({ viewComfyJSON: { ...config, id: workflow.id } });
          } else {
            const [config, workflowApi] = await Promise.all([
              readJsonAsset<Record<string, unknown>>(configPath),
              readJsonAsset<unknown>(workflowApiPath),
            ]);

            viewComfys.push({
              viewComfyJSON: { ...config, id: workflow.id },
              workflowApiJSON: workflowApi,
            });
          }
        } catch (workflowError) {
          console.error(`Failed to load workflow ${workflow.folder}:`, workflowError);
        }
      }

      return {
        appTitle: indexData.appTitle,
        appImg: indexData.appImg,
        viewComfys,
      };
    } catch (error) {
      for (const fallbackPath of this.getLegacyFallbackPaths()) {
        try {
          return await readJsonAsset<unknown>(fallbackPath);
        } catch {
          // try next fallback
        }
      }
      console.error('Failed to load workflow configuration', error);
      throw new HttpError(500, 'Failed to load workflow configuration', { error });
    }
  }

  public async saveConfig(payload: ViewComfyConfigPayload): Promise<{ message: string }> {
    const indexPath = this.getIndexPath();

    try {
      const indexData: WorkflowIndexData = {
        appTitle: payload.appTitle || 'ViewComfy',
        appImg: payload.appImg || '',
        workflows: [],
      };

      const usedFolders = new Set<string>();
      const usedIds = new Set<string>();

      for (const viewComfy of payload.viewComfys) {
        const config = (viewComfy.viewComfyJSON || {}) as Record<string, unknown>;
        const workflowApi = viewComfy.workflowApiJSON;

        const entry: WorkflowIndexItem = createGovernedWorkflowEntry(
          String(config.title || 'Untitled Workflow'),
          usedFolders,
          usedIds,
        );
        const { configPath, workflowApiPath } = this.getWorkflowFiles(entry.folder);

        const normalizedConfig = {
          ...config,
          id: entry.id,
          title: entry.title,
        };

        await Promise.all([
          uploadTextAssetToRuntimeCdn(configPath, JSON.stringify(normalizedConfig, null, 2), 'application/json'),
          uploadTextAssetToRuntimeCdn(workflowApiPath, JSON.stringify(workflowApi ?? {}, null, 2), 'application/json'),
        ]);

        indexData.workflows.push(entry);
      }

      const { normalized } = governWorkflowIndex(indexData);
      await uploadTextAssetToRuntimeCdn(indexPath, JSON.stringify(normalized, null, 2), 'application/json');
      return { message: 'Workflow configuration saved successfully' };
    } catch (error) {
      console.error('Failed to save workflow configuration to CDN', error);
      throw new HttpError(500, 'Failed to save workflow configuration', { error });
    }
  }

  public async updateWorkflow(
    id: string,
    payload: { viewComfyJSON: Record<string, unknown>; workflowApiJSON: Record<string, unknown> },
  ): Promise<{ message: string }> {
    const indexPath = this.getIndexPath();

    try {
      const indexData = await this.readGovernedIndex();

      const workflowIndex = indexData.workflows.findIndex((wf) => wf.id === id);
      if (workflowIndex === -1) {
        throw new HttpError(404, `Workflow with id ${id} not found`);
      }

      const workflowItem = indexData.workflows[workflowIndex];
      const { configPath, workflowApiPath } = this.getWorkflowFiles(workflowItem.folder);

      const normalizedConfig = {
        ...payload.viewComfyJSON,
        id: workflowItem.id,
        title: String(payload.viewComfyJSON.title || workflowItem.title),
      };

      await Promise.all([
        uploadTextAssetToRuntimeCdn(configPath, JSON.stringify(normalizedConfig, null, 2), 'application/json'),
        uploadTextAssetToRuntimeCdn(workflowApiPath, JSON.stringify(payload.workflowApiJSON, null, 2), 'application/json'),
      ]);

      if (normalizedConfig.title !== workflowItem.title) {
        indexData.workflows[workflowIndex].title = normalizedConfig.title;
        const { normalized } = governWorkflowIndex(indexData);
        await uploadTextAssetToRuntimeCdn(indexPath, JSON.stringify(normalized, null, 2), 'application/json');
      }

      return { message: 'Workflow updated successfully' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error(`Failed to update workflow ${id}:`, error);
      throw new HttpError(500, `Failed to update workflow ${id}`, { error });
    }
  }

  public async getWorkflowById(id: string): Promise<Record<string, unknown>> {
    const indexData = await this.readGovernedIndex();

    const workflowItem = indexData.workflows.find((wf) => wf.id === id);
    if (!workflowItem) {
      throw new HttpError(404, `Workflow with id ${id} not found`);
    }

    const { configPath, workflowApiPath } = this.getWorkflowFiles(workflowItem.folder);
    const [config, workflowApi] = await Promise.all([
      readJsonAsset<Record<string, unknown>>(configPath),
      readJsonAsset<unknown>(workflowApiPath),
    ]);

    return {
      viewComfyJSON: { ...config, id: workflowItem.id },
      workflowApiJSON: workflowApi,
    };
  }
}
