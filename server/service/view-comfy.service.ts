import { promises as fs } from 'fs';
import path from 'path';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';
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
  private getWorkflowsDir() {
    return path.join(process.cwd(), 'workflows');
  }

  private getIndexPath() {
    return path.join(this.getWorkflowsDir(), 'index.json');
  }

  private async readGovernedIndex(): Promise<WorkflowIndexData> {
    const indexPath = this.getIndexPath();
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(indexContent) as WorkflowIndexData;
    const { normalized, changed, issues } = governWorkflowIndex(parsed);

    if (issues.length > 0) {
      for (const issue of issues) {
        const method = issue.level === 'error' ? 'error' : 'warn';
        console[method](`[ViewComfyService][${issue.code}] ${issue.message}`);
      }
    }

    if (changed) {
      await fs.writeFile(indexPath, JSON.stringify(normalized, null, 2), 'utf-8');
    }

    return normalized;
  }

  public async getConfig(lightweight: boolean = false): Promise<unknown> {
    const workflowsDir = this.getWorkflowsDir();

    try {
      const indexData = await this.readGovernedIndex();

      const viewComfys: Record<string, unknown>[] = [];
      for (const workflow of indexData.workflows) {
        const workflowDir = path.join(workflowsDir, workflow.folder);
        const configPath = path.join(workflowDir, 'config.json');
        const workflowApiPath = path.join(workflowDir, 'workflow.json');

        try {
          if (lightweight) {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent) as Record<string, unknown>;
            if (config.id !== workflow.id) {
              config.id = workflow.id;
              await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
            }
            viewComfys.push({ viewComfyJSON: config });
          } else {
            const [configContent, workflowApiContent] = await Promise.all([
              fs.readFile(configPath, 'utf-8'),
              fs.readFile(workflowApiPath, 'utf-8'),
            ]);

            const config = JSON.parse(configContent) as Record<string, unknown>;
            const workflowApi = JSON.parse(workflowApiContent);

            if (config.id !== workflow.id) {
              config.id = workflow.id;
              await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
            }

            viewComfys.push({
              viewComfyJSON: config,
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
      const fallbackPath = path.join(process.cwd(), '../view_comfy.json');
      try {
        const fileContent = await fs.readFile(fallbackPath, 'utf-8');
        return JSON.parse(fileContent);
      } catch (fallbackError) {
        console.error('Failed to load workflow configuration', error, fallbackError);
        throw new HttpError(500, 'Failed to load workflow configuration', {
          error,
          fallbackError,
        });
      }
    }
  }

  public async saveConfig(payload: ViewComfyConfigPayload): Promise<{ message: string }> {
    const workflowsDir = this.getWorkflowsDir();
    const indexPath = this.getIndexPath();

    try {
      await fs.mkdir(workflowsDir, { recursive: true });

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
        const workflowDir = path.join(workflowsDir, entry.folder);

        await fs.mkdir(workflowDir, { recursive: true });

        const normalizedConfig = {
          ...config,
          id: entry.id,
          title: entry.title,
        };

        await Promise.all([
          fs.writeFile(path.join(workflowDir, 'config.json'), JSON.stringify(normalizedConfig, null, 2), 'utf-8'),
          fs.writeFile(path.join(workflowDir, 'workflow.json'), JSON.stringify(workflowApi ?? {}, null, 2), 'utf-8'),
        ]);

        indexData.workflows.push(entry);
      }

      const { normalized } = governWorkflowIndex(indexData);
      await fs.writeFile(indexPath, JSON.stringify(normalized, null, 2), 'utf-8');
      return { message: 'Workflow configuration saved successfully' };
    } catch (error) {
      const fallbackPath = path.join(process.cwd(), '../view_comfy.json');
      try {
        await fs.writeFile(fallbackPath, JSON.stringify(payload, null, 2), 'utf-8');
        return { message: 'Configuration saved to view_comfy.json (fallback)' };
      } catch (fallbackError) {
        console.error('Failed to save workflow configuration', error, fallbackError);
        throw new HttpError(500, 'Failed to save workflow configuration', {
          error,
          fallbackError,
        });
      }
    }
  }

  public async updateWorkflow(
    id: string,
    payload: { viewComfyJSON: Record<string, unknown>; workflowApiJSON: Record<string, unknown> },
  ): Promise<{ message: string }> {
    const workflowsDir = this.getWorkflowsDir();
    const indexPath = this.getIndexPath();

    try {
      const indexData = await this.readGovernedIndex();

      const workflowIndex = indexData.workflows.findIndex((wf) => wf.id === id);
      if (workflowIndex === -1) {
        throw new HttpError(404, `Workflow with id ${id} not found`);
      }

      const workflowItem = indexData.workflows[workflowIndex];
      const workflowDir = path.join(workflowsDir, workflowItem.folder);

      const normalizedConfig = {
        ...payload.viewComfyJSON,
        id: workflowItem.id,
        title: String(payload.viewComfyJSON.title || workflowItem.title),
      };

      await Promise.all([
        fs.writeFile(path.join(workflowDir, 'config.json'), JSON.stringify(normalizedConfig, null, 2), 'utf-8'),
        fs.writeFile(path.join(workflowDir, 'workflow.json'), JSON.stringify(payload.workflowApiJSON, null, 2), 'utf-8'),
      ]);

      if (normalizedConfig.title !== workflowItem.title) {
        indexData.workflows[workflowIndex].title = normalizedConfig.title;
        const { normalized } = governWorkflowIndex(indexData);
        await fs.writeFile(indexPath, JSON.stringify(normalized, null, 2), 'utf-8');
      }

      return { message: 'Workflow updated successfully' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error(`Failed to update workflow ${id}:`, error);
      throw new HttpError(500, `Failed to update workflow ${id}`, { error });
    }
  }

  public async getWorkflowById(id: string): Promise<Record<string, unknown>> {
    const workflowsDir = this.getWorkflowsDir();

    const indexData = await this.readGovernedIndex();

    const workflowItem = indexData.workflows.find((wf) => wf.id === id);
    if (!workflowItem) {
      throw new HttpError(404, `Workflow with id ${id} not found`);
    }

    const workflowDir = path.join(workflowsDir, workflowItem.folder);
    const [configContent, workflowApiContent] = await Promise.all([
      fs.readFile(path.join(workflowDir, 'config.json'), 'utf-8'),
      fs.readFile(path.join(workflowDir, 'workflow.json'), 'utf-8'),
    ]);

    const config = JSON.parse(configContent) as Record<string, unknown>;
    if (config.id !== workflowItem.id) {
      config.id = workflowItem.id;
      await fs.writeFile(path.join(workflowDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
    }

    return {
      viewComfyJSON: config,
      workflowApiJSON: JSON.parse(workflowApiContent),
    };
  }
}
