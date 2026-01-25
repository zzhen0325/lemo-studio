import { promises as fs } from 'fs';
import path from 'path';
import { Injectable } from '@gulux/gulux';
import { HttpError } from '../utils/http-error';

interface WorkflowIndexItem {
  title: string;
  folder: string;
  id: string;
}

interface IndexData {
  appTitle: string;
  appImg: string;
  workflows: WorkflowIndexItem[];
}

export interface ViewComfyConfigPayload {
  appTitle: string;
  appImg: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewComfys: any[];
}

@Injectable()
export class ViewComfyConfigService {
  private getWorkflowsDir() {
    return path.join(process.cwd(), 'workflows');
  }

  private getIndexPath() {
    return path.join(this.getWorkflowsDir(), 'index.json');
  }

  public async getConfig(): Promise<any> {
    const workflowsDir = this.getWorkflowsDir();
    const indexPath = this.getIndexPath();

    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent) as IndexData & { workflows: any[] };

      const viewComfys: any[] = [];
      for (const workflow of indexData.workflows) {
        const workflowDir = path.join(workflowsDir, workflow.folder);
        const configPath = path.join(workflowDir, 'config.json');
        const workflowApiPath = path.join(workflowDir, 'workflow.json');

        try {
          const [configContent, workflowApiContent] = await Promise.all([
            fs.readFile(configPath, 'utf-8'),
            fs.readFile(workflowApiPath, 'utf-8'),
          ]);

          const config = JSON.parse(configContent);
          const workflowApi = JSON.parse(workflowApiContent);

          viewComfys.push({
            viewComfyJSON: config,
            workflowApiJSON: workflowApi,
          });
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

      const indexData: IndexData = {
        appTitle: payload.appTitle,
        appImg: payload.appImg,
        workflows: [],
      };

      for (const viewComfy of payload.viewComfys) {
        const config = viewComfy.viewComfyJSON;
        const workflowApi = viewComfy.workflowApiJSON;

        const folderName = config.title.replace(/[<>:"/\\|?*]/g, '_').trim();
        const workflowDir = path.join(workflowsDir, folderName);

        await fs.mkdir(workflowDir, { recursive: true });

        const workflowId = `wf_${folderName.toLowerCase()}`;
        config.id = workflowId;

        await Promise.all([
          fs.writeFile(path.join(workflowDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8'),
          fs.writeFile(path.join(workflowDir, 'workflow.json'), JSON.stringify(workflowApi, null, 2), 'utf-8'),
        ]);

        indexData.workflows.push({
          title: config.title,
          folder: folderName,
          id: workflowId,
        });
      }

      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
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
}
