import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  createGovernedWorkflowEntry,
  governWorkflowIndex,
  type WorkflowIndexData,
  type WorkflowIndexItem,
} from '@/lib/workflow-governance';

function buildWorkflowsDir() {
  return path.join(process.cwd(), 'workflows');
}

function buildIndexPath(workflowsDir: string) {
  return path.join(workflowsDir, 'index.json');
}

async function readGovernedIndex(indexPath: string): Promise<WorkflowIndexData> {
  const indexContent = await fs.readFile(indexPath, 'utf-8');
  const parsed = JSON.parse(indexContent) as WorkflowIndexData;
  const { normalized, changed, issues } = governWorkflowIndex(parsed);

  if (issues.length > 0) {
    for (const issue of issues) {
      const method = issue.level === 'error' ? 'error' : 'warn';
      console[method](`[ViewComfyAPI][${issue.code}] ${issue.message}`);
    }
  }

  if (changed) {
    await fs.writeFile(indexPath, JSON.stringify(normalized, null, 2), 'utf-8');
  }

  return normalized;
}

export async function GET() {
  const workflowsDir = buildWorkflowsDir();
  const indexPath = buildIndexPath(workflowsDir);

  try {
    const indexData = await readGovernedIndex(indexPath);

    const viewComfys: Array<Record<string, unknown>> = [];

    for (const workflow of indexData.workflows) {
      const workflowDir = path.join(workflowsDir, workflow.folder);
      const configPath = path.join(workflowDir, 'config.json');
      const workflowApiPath = path.join(workflowDir, 'workflow.json');

      try {
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
      } catch (workflowError) {
        console.error(`[ViewComfyAPI] Failed to load workflow ${workflow.folder}:`, workflowError);
      }
    }

    return NextResponse.json({
      appTitle: indexData.appTitle,
      appImg: indexData.appImg,
      viewComfys,
    });
  } catch (error) {
    const fallbackPath = path.join(process.cwd(), 'view_comfy.json');
    try {
      const fileContent = await fs.readFile(fallbackPath, 'utf-8');
      const json = JSON.parse(fileContent);
      return NextResponse.json(json);
    } catch (fallbackError) {
      return NextResponse.json(
        {
          error: 'Failed to load workflow configuration',
          details: `Could not load from workflows directory: ${error}. Fallback to view_comfy.json also failed: ${fallbackError}`,
        },
        { status: 500 },
      );
    }
  }
}

export async function POST(request: Request) {
  const workflowsDir = buildWorkflowsDir();
  const indexPath = buildIndexPath(workflowsDir);

  let updatedData: Record<string, unknown>;
  try {
    updatedData = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const rawViewComfys = Array.isArray(updatedData.viewComfys)
      ? (updatedData.viewComfys as Array<Record<string, unknown>>)
      : [];

    await fs.mkdir(workflowsDir, { recursive: true });

    const indexData: WorkflowIndexData = {
      appTitle: String(updatedData.appTitle || 'ViewComfy'),
      appImg: String(updatedData.appImg || ''),
      workflows: [],
    };

    const usedFolders = new Set<string>();
    const usedIds = new Set<string>();

    for (const viewComfy of rawViewComfys) {
      const config = (viewComfy.viewComfyJSON || {}) as Record<string, unknown>;
      const workflowApi = viewComfy.workflowApiJSON;
      const title = String(config.title || 'Untitled Workflow');

      const entry: WorkflowIndexItem = createGovernedWorkflowEntry(title, usedFolders, usedIds);
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

    return NextResponse.json({ message: 'Workflow configuration saved successfully' });
  } catch (error) {
    const fallbackPath = path.join(process.cwd(), 'view_comfy.json');
    try {
      await fs.writeFile(fallbackPath, JSON.stringify(updatedData, null, 2), 'utf-8');
      return NextResponse.json({ message: 'Configuration saved to view_comfy.json (fallback)' });
    } catch (fallbackError) {
      return NextResponse.json(
        {
          error: 'Failed to save workflow configuration',
          details: `Could not save to workflows directory: ${error}. Fallback to view_comfy.json also failed: ${fallbackError}`,
        },
        { status: 500 },
      );
    }
  }
}
