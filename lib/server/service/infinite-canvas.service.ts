import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Inject, Injectable } from '../compat/gulux';
import type { ModelType } from '../compat/typegoose';
import { InfiniteCanvasProject as InfiniteCanvasProjectEntity } from '../db';
import { HttpError } from '../utils/http-error';
import { restoreMongoKeys, sanitizeMongoKeys } from '../utils/mongo';
import type {
  InfiniteCanvasProject,
  InfiniteCanvasProjectSummary,
  InfiniteCanvasStore,
  InfiniteCanvasNode,
  InfiniteCanvasEdge,
  InfiniteCanvasHistoryItem,
  InfiniteCanvasQueueItem,
} from '@/types/infinite-canvas';

interface CreateProjectPayload {
  projectName?: string;
}

function nowISO() {
  return new Date().toISOString();
}

function getWorkspaceRoot() {
  const cwd = process.cwd();
  return cwd.endsWith(`${path.sep}server`) ? path.join(cwd, '..') : cwd;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimProjectName(input?: string) {
  const value = (input || '').trim();
  if (!value) {
    return '未命名项目';
  }
  return value.slice(0, 50);
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeNode(node: InfiniteCanvasNode): InfiniteCanvasNode {
  const createdAt = node.createdAt || nowISO();
  const updatedAt = node.updatedAt || nowISO();
  return {
    ...node,
    nodeId: node.nodeId || randomUUID(),
    title: node.title || (node.nodeType === 'text' ? 'Text Node' : 'Image Node'),
    width: Number(node.width) > 0 ? Number(node.width) : 320,
    height: Number(node.height) > 0 ? Number(node.height) : (node.nodeType === 'text' ? 220 : 300),
    position: {
      x: Number(node.position?.x) || 0,
      y: Number(node.position?.y) || 0,
    },
    status: node.status || 'idle',
    isLocked: Boolean(node.isLocked),
    isSelected: Boolean(node.isSelected),
    outputs: ensureArray<InfiniteCanvasNode['outputs'][number]>(node.outputs).map((output) => ({
      ...output,
      outputId: output.outputId || randomUUID(),
      createdAt: output.createdAt || nowISO(),
    })),
    createdAt,
    updatedAt,
  };
}

function normalizeEdge(edge: InfiniteCanvasEdge): InfiniteCanvasEdge {
  return {
    ...edge,
    edgeId: edge.edgeId || randomUUID(),
    sourcePort: edge.sourcePort || 'output',
    targetPort: edge.targetPort || 'input',
    createdAt: edge.createdAt || nowISO(),
  };
}

function normalizeHistoryItem(item: InfiniteCanvasHistoryItem): InfiniteCanvasHistoryItem {
  return {
    ...item,
    historyId: item.historyId || randomUUID(),
    createdAt: item.createdAt || nowISO(),
    status: item.status || 'success',
  };
}

function normalizeQueueItem(item: InfiniteCanvasQueueItem): InfiniteCanvasQueueItem {
  return {
    ...item,
    queueId: item.queueId || randomUUID(),
    startedAt: item.startedAt || nowISO(),
    status: item.status || 'queued',
  };
}

function normalizeProject(project: InfiniteCanvasProject): InfiniteCanvasProject {
  const createdAt = project.createdAt || nowISO();
  const updatedAt = project.updatedAt || nowISO();

  return {
    ...project,
    projectId: project.projectId || randomUUID(),
    projectName: trimProjectName(project.projectName),
    createdAt,
    updatedAt,
    nodeCount: ensureArray<InfiniteCanvasNode>(project.nodes).length,
    canvasViewport: {
      x: Number(project.canvasViewport?.x) || 0,
      y: Number(project.canvasViewport?.y) || 0,
      scale: Number(project.canvasViewport?.scale) || 1,
    },
    lastOpenedPanel: project.lastOpenedPanel ?? null,
    nodes: ensureArray<InfiniteCanvasNode>(project.nodes).map(normalizeNode),
    edges: ensureArray<InfiniteCanvasEdge>(project.edges).map(normalizeEdge),
    assets: ensureArray<InfiniteCanvasProject['assets'][number]>(project.assets),
    history: ensureArray<InfiniteCanvasHistoryItem>(project.history).map(normalizeHistoryItem),
    runQueue: ensureArray<InfiniteCanvasQueueItem>(project.runQueue).map(normalizeQueueItem),
  };
}

function createEmptyProject(name?: string): InfiniteCanvasProject {
  const time = nowISO();
  return {
    projectId: randomUUID(),
    projectName: trimProjectName(name),
    createdAt: time,
    updatedAt: time,
    nodeCount: 0,
    canvasViewport: { x: 0, y: 0, scale: 1 },
    lastOpenedPanel: null,
    nodes: [],
    edges: [],
    assets: [],
    history: [],
    runQueue: [],
  };
}

function buildSummary(project: InfiniteCanvasProject): InfiniteCanvasProjectSummary {
  const latestImageOutput = [...project.history]
    .reverse()
    .find((item) => item.outputType === 'image' && item.outputUrl)?.outputUrl;

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    coverUrl: project.coverUrl,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodes.length,
    lastOutputPreview: latestImageOutput,
  };
}

function toEntityPayload(project: InfiniteCanvasProject): Record<string, unknown> {
  return sanitizeMongoKeys({
    projectId: project.projectId,
    projectName: project.projectName,
    coverUrl: project.coverUrl,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodes.length,
    canvasViewport: project.canvasViewport,
    lastOpenedPanel: project.lastOpenedPanel ?? null,
    nodes: project.nodes,
    edges: project.edges,
    assets: project.assets,
    history: project.history,
    runQueue: project.runQueue,
  }) as Record<string, unknown>;
}

function fromEntityDoc(doc: unknown): InfiniteCanvasProject {
  const restored = restoreMongoKeys(doc) as Record<string, unknown>;

  const project: InfiniteCanvasProject = {
    projectId: typeof restored.projectId === 'string' ? restored.projectId : randomUUID(),
    projectName: trimProjectName(typeof restored.projectName === 'string' ? restored.projectName : undefined),
    coverUrl: typeof restored.coverUrl === 'string' ? restored.coverUrl : undefined,
    createdAt: typeof restored.createdAt === 'string' ? restored.createdAt : nowISO(),
    updatedAt: typeof restored.updatedAt === 'string' ? restored.updatedAt : nowISO(),
    nodeCount: Number(restored.nodeCount) || 0,
    canvasViewport: {
      x: Number((restored.canvasViewport as Record<string, unknown> | undefined)?.x) || 0,
      y: Number((restored.canvasViewport as Record<string, unknown> | undefined)?.y) || 0,
      scale: Number((restored.canvasViewport as Record<string, unknown> | undefined)?.scale) || 1,
    },
    lastOpenedPanel: (restored.lastOpenedPanel as InfiniteCanvasProject['lastOpenedPanel']) ?? null,
    nodes: ensureArray<InfiniteCanvasNode>(restored.nodes),
    edges: ensureArray<InfiniteCanvasEdge>(restored.edges),
    assets: ensureArray<InfiniteCanvasProject['assets'][number]>(restored.assets),
    history: ensureArray<InfiniteCanvasHistoryItem>(restored.history),
    runQueue: ensureArray<InfiniteCanvasQueueItem>(restored.runQueue),
  };

  return normalizeProject(project);
}

const LEGACY_STORE_PATH = path.join(getWorkspaceRoot(), 'data', 'infinite-canvas', 'projects.json');

@Injectable()
export class InfiniteCanvasService {
  @Inject(InfiniteCanvasProjectEntity)
  private projectModel!: ModelType<InfiniteCanvasProjectEntity>;

  private migrationChecked = false;

  private async migrateFromLegacyJsonIfNeeded(): Promise<void> {
    if (this.migrationChecked) {
      return;
    }
    this.migrationChecked = true;

    try {
      const existingCount = await this.projectModel.estimatedDocumentCount();
      if (existingCount > 0) {
        return;
      }

      let raw = '';
      try {
        raw = await fs.readFile(LEGACY_STORE_PATH, 'utf-8');
      } catch {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<InfiniteCanvasStore>;
      const projects = ensureArray<InfiniteCanvasProject>(parsed.projects).map(normalizeProject);
      if (projects.length === 0) {
        return;
      }

      await this.projectModel.bulkWrite(
        projects.map((project) => ({
          updateOne: {
            filter: { projectId: project.projectId },
            update: { $set: toEntityPayload(project) },
            upsert: true,
          },
        })),
        { ordered: false },
      );

      console.info(`[InfiniteCanvasService] Migrated ${projects.length} project(s) from legacy JSON store.`);
    } catch (error) {
      console.error('[InfiniteCanvasService] Legacy migration failed:', error);
    }
  }

  private async loadProjectById(projectId: string): Promise<InfiniteCanvasProject | null> {
    await this.migrateFromLegacyJsonIfNeeded();
    const doc = (await this.projectModel.findOne({ projectId }).lean()) as unknown;
    return doc ? fromEntityDoc(doc) : null;
  }

  public async listProjects(): Promise<{ projects: InfiniteCanvasProjectSummary[] }> {
    await this.migrateFromLegacyJsonIfNeeded();
    const docs = (await this.projectModel.find().sort({ updatedAt: -1 }).lean()) as unknown[];
    const projects = docs.map((doc) => fromEntityDoc(doc)).map(buildSummary);
    return { projects };
  }

  public async createProject(payload: CreateProjectPayload): Promise<{ project: InfiniteCanvasProject }> {
    await this.migrateFromLegacyJsonIfNeeded();
    const project = createEmptyProject(payload.projectName);

    await this.projectModel.updateOne(
      { projectId: project.projectId },
      { $set: toEntityPayload(project) },
      { upsert: true },
    );

    return { project };
  }

  public async getProject(projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    const project = await this.loadProjectById(projectId);

    if (!project) {
      throw new HttpError(404, 'Project not found');
    }

    return { project };
  }

  public async saveProject(projectId: string, payload: InfiniteCanvasProject): Promise<{ project: InfiniteCanvasProject }> {
    if (!payload || typeof payload !== 'object') {
      throw new HttpError(400, 'Invalid project payload');
    }

    const existing = await this.loadProjectById(projectId);
    if (!existing) {
      throw new HttpError(404, 'Project not found');
    }

    const next = normalizeProject({
      ...payload,
      projectId,
      createdAt: existing.createdAt,
      updatedAt: nowISO(),
      projectName: trimProjectName(payload.projectName || existing.projectName),
    });

    await this.projectModel.updateOne(
      { projectId },
      { $set: toEntityPayload(next) },
      { upsert: false },
    );

    return { project: next };
  }

  public async renameProject(projectId: string, projectName: string): Promise<{ project: InfiniteCanvasProject }> {
    const existing = await this.loadProjectById(projectId);

    if (!existing) {
      throw new HttpError(404, 'Project not found');
    }

    const next = normalizeProject({
      ...existing,
      projectName: trimProjectName(projectName),
      updatedAt: nowISO(),
    });

    await this.projectModel.updateOne(
      { projectId },
      { $set: toEntityPayload(next) },
      { upsert: false },
    );

    return { project: next };
  }

  public async duplicateProject(projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    const source = await this.loadProjectById(projectId);

    if (!source) {
      throw new HttpError(404, 'Project not found');
    }

    const copied = clone(source);
    const nodeIdMap = new Map<string, string>();

    const now = nowISO();
    const duplicatedNodes = copied.nodes.map((node) => {
      const nextNodeId = randomUUID();
      nodeIdMap.set(node.nodeId, nextNodeId);
      return {
        ...node,
        nodeId: nextNodeId,
        outputs: ensureArray<InfiniteCanvasNode['outputs'][number]>(node.outputs).map((output) => ({
          ...output,
          outputId: randomUUID(),
        })),
        createdAt: now,
        updatedAt: now,
      };
    });

    const duplicated = normalizeProject({
      ...copied,
      projectId: randomUUID(),
      projectName: `${source.projectName} 副本`,
      createdAt: now,
      updatedAt: now,
      nodes: duplicatedNodes,
      edges: copied.edges
        .map((edge) => {
          const sourceNodeId = nodeIdMap.get(edge.sourceNodeId);
          const targetNodeId = nodeIdMap.get(edge.targetNodeId);
          if (!sourceNodeId || !targetNodeId) return null;
          return {
            ...edge,
            edgeId: randomUUID(),
            sourceNodeId,
            targetNodeId,
            createdAt: now,
          };
        })
        .filter(Boolean) as InfiniteCanvasEdge[],
      history: copied.history.map((item) => ({
        ...item,
        historyId: randomUUID(),
        nodeId: nodeIdMap.get(item.nodeId) || item.nodeId,
        createdAt: now,
      })),
      runQueue: [],
      lastOpenedPanel: null,
    });

    await this.projectModel.updateOne(
      { projectId: duplicated.projectId },
      { $set: toEntityPayload(duplicated) },
      { upsert: true },
    );

    return { project: duplicated };
  }

  public async deleteProject(projectId: string): Promise<{ success: true }> {
    await this.migrateFromLegacyJsonIfNeeded();
    const result = await this.projectModel.deleteOne({ projectId });
    const deleteResult = result as unknown as { deletedCount?: number; result?: { n?: number } };
    const deleted = deleteResult.deletedCount ?? deleteResult.result?.n ?? 0;

    if (!deleted) {
      throw new HttpError(404, 'Project not found');
    }

    return { success: true };
  }
}
