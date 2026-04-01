import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { InfiniteCanvasRepository } from '../repositories';
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

function toEntityPayload(project: InfiniteCanvasProject, ownerId?: string | null): Record<string, unknown> {
  return sanitizeMongoKeys({
    projectId: project.projectId,
    userId: ownerId ?? null,
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

function restoreProjectRecord(doc: unknown): Record<string, unknown> {
  return restoreMongoKeys(doc) as Record<string, unknown>;
}

function fromEntityDoc(doc: unknown): InfiniteCanvasProject {
  const restored = restoreProjectRecord(doc);

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

function getProjectOwnerId(doc: unknown): string | null {
  const restored = restoreProjectRecord(doc);
  return typeof restored.userId === 'string' && restored.userId.trim()
    ? restored.userId
    : null;
}

const LEGACY_STORE_PATH = path.join(getWorkspaceRoot(), 'data', 'infinite-canvas', 'projects.json');
type ProjectStoreMode = 'auto' | 'supabase' | 'json';
const PRIMARY_STORE_TIMEOUT_MS = 8000;

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }

  return '';
}

function shouldFallbackToLocalStore(error: unknown): boolean {
  const message = readErrorMessage(error).trim().toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes('unauthorized')
    || message.includes('jwt')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('coze_supabase_url is not set')
    || message.includes('db_password or coze_supabase_anon_key is not set')
  );
}

export class InfiniteCanvasService {
  constructor(private readonly infiniteCanvasRepository: InfiniteCanvasRepository) {}

  private migrationChecked = false;
  private projectStoreMode: ProjectStoreMode = 'auto';

  private async withProjectStoreFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.projectStoreMode === 'json') {
      return fallback();
    }

    try {
      const primaryPromise = primary();
      // If timeout wins the race, avoid later unhandled rejections from the primary branch.
      primaryPromise.catch(() => {});
      const result = await this.withTimeout(
        primaryPromise,
        PRIMARY_STORE_TIMEOUT_MS,
        'Infinite canvas Supabase request timeout',
      );
      this.projectStoreMode = 'supabase';
      return result;
    } catch (error) {
      if (!shouldFallbackToLocalStore(error)) {
        throw error;
      }

      console.warn('[InfiniteCanvasService] Supabase unavailable, using local JSON store.');
      this.projectStoreMode = 'json';
      return fallback();
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${message} (${timeoutMs}ms)`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async readLocalStore(): Promise<InfiniteCanvasStore> {
    try {
      const raw = await fs.readFile(LEGACY_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<InfiniteCanvasStore>;
      return {
        version: 1,
        projects: ensureArray<InfiniteCanvasProject>(parsed.projects).map(normalizeProject),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') {
        return { version: 1, projects: [] };
      }
      throw error;
    }
  }

  private async writeLocalStore(store: InfiniteCanvasStore): Promise<void> {
    await fs.mkdir(path.dirname(LEGACY_STORE_PATH), { recursive: true });
    await fs.writeFile(
      LEGACY_STORE_PATH,
      JSON.stringify(
        {
          version: 1,
          projects: store.projects.map(normalizeProject),
        },
        null,
        2,
      ),
      'utf-8',
    );
  }

  private async getLocalProjectEntry(projectId: string) {
    const store = await this.readLocalStore();
    const index = store.projects.findIndex((project) => project.projectId === projectId);
    if (index < 0) {
      throw new HttpError(404, 'Project not found');
    }

    return {
      store,
      index,
      project: normalizeProject(store.projects[index]),
    };
  }

  private async listProjectsFromLocalStore(): Promise<{ projects: InfiniteCanvasProjectSummary[] }> {
    const store = await this.readLocalStore();
    const projects = [...store.projects]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .map(buildSummary);

    return { projects };
  }

  private async createProjectInLocalStore(payload: CreateProjectPayload): Promise<{ project: InfiniteCanvasProject }> {
    const store = await this.readLocalStore();
    const project = createEmptyProject(payload.projectName);
    store.projects.unshift(project);
    await this.writeLocalStore(store);
    return { project };
  }

  private async getProjectFromLocalStore(projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    const entry = await this.getLocalProjectEntry(projectId);
    return { project: entry.project };
  }

  private async saveProjectInLocalStore(projectId: string, payload: InfiniteCanvasProject): Promise<{ project: InfiniteCanvasProject }> {
    if (!payload || typeof payload !== 'object') {
      throw new HttpError(400, 'Invalid project payload');
    }

    const entry = await this.getLocalProjectEntry(projectId);
    const next = normalizeProject({
      ...payload,
      projectId,
      createdAt: entry.project.createdAt,
      updatedAt: nowISO(),
      projectName: trimProjectName(payload.projectName || entry.project.projectName),
    });

    entry.store.projects[entry.index] = next;
    await this.writeLocalStore(entry.store);
    return { project: next };
  }

  private async renameProjectInLocalStore(projectId: string, projectName: string): Promise<{ project: InfiniteCanvasProject }> {
    const entry = await this.getLocalProjectEntry(projectId);
    const next = normalizeProject({
      ...entry.project,
      projectName: trimProjectName(projectName),
      updatedAt: nowISO(),
    });

    entry.store.projects[entry.index] = next;
    await this.writeLocalStore(entry.store);
    return { project: next };
  }

  private async duplicateProjectInLocalStore(projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    const entry = await this.getLocalProjectEntry(projectId);
    const source = entry.project;
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

    entry.store.projects.unshift(duplicated);
    await this.writeLocalStore(entry.store);
    return { project: duplicated };
  }

  private async deleteProjectInLocalStore(projectId: string): Promise<{ success: true }> {
    const store = await this.readLocalStore();
    const nextProjects = store.projects.filter((project) => project.projectId !== projectId);
    if (nextProjects.length === store.projects.length) {
      throw new HttpError(404, 'Project not found');
    }

    store.projects = nextProjects;
    await this.writeLocalStore(store);
    return { success: true };
  }

  private async claimProjectOwner(projectId: string, actorId: string): Promise<void> {
    await this.infiniteCanvasRepository.claimOwner(projectId, actorId);
  }

  private async loadProjectRecord(projectId: string): Promise<{ project: InfiniteCanvasProject; ownerId: string | null } | null> {
    await this.migrateFromLegacyJsonIfNeeded();
    const doc = (await this.infiniteCanvasRepository.findByProjectId(projectId)) as unknown;
    if (!doc) {
      return null;
    }

    return {
      project: fromEntityDoc(doc),
      ownerId: getProjectOwnerId(doc),
    };
  }

  private async loadOwnedProject(projectId: string, actorId: string): Promise<InfiniteCanvasProject | null> {
    const record = await this.loadProjectRecord(projectId);
    if (!record) {
      return null;
    }

    if (record.ownerId && record.ownerId !== actorId) {
      return null;
    }

    if (!record.ownerId) {
      await this.claimProjectOwner(projectId, actorId);
    }

    return record.project;
  }

  private async migrateFromLegacyJsonIfNeeded(): Promise<void> {
    if (this.migrationChecked) {
      return;
    }
    this.migrationChecked = true;

    try {
      const existingCount = await this.infiniteCanvasRepository.countProjects();
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

      await this.infiniteCanvasRepository.bulkUpsert(
        projects.map((project) => ({
          projectId: project.projectId,
          payload: toEntityPayload(project),
        })),
      );

      console.info(`[InfiniteCanvasService] Migrated ${projects.length} project(s) from legacy JSON store.`);
    } catch (error) {
      if (shouldFallbackToLocalStore(error)) {
        this.projectStoreMode = 'json';
        console.warn('[InfiniteCanvasService] Skipping Supabase migration check, local JSON store mode enabled.');
        return;
      }
      console.error('[InfiniteCanvasService] Legacy migration failed:', error);
    }
  }

  public async listProjects(actorId: string): Promise<{ projects: InfiniteCanvasProjectSummary[] }> {
    await this.migrateFromLegacyJsonIfNeeded();
    return this.withProjectStoreFallback(
      async () => {
        const docs = (await this.infiniteCanvasRepository.listProjects()) as unknown[];
        const projects: InfiniteCanvasProjectSummary[] = [];
        const unownedProjectIds: string[] = [];

        for (const doc of docs) {
          const ownerId = getProjectOwnerId(doc);
          if (ownerId && ownerId !== actorId) {
            continue;
          }

          const project = fromEntityDoc(doc);
          projects.push(buildSummary(project));

          if (!ownerId) {
            unownedProjectIds.push(project.projectId);
          }
        }

        if (unownedProjectIds.length > 0) {
          await Promise.all(unownedProjectIds.map((projectId) => this.claimProjectOwner(projectId, actorId)));
        }

        return { projects };
      },
      () => this.listProjectsFromLocalStore(),
    );
  }

  public async createProject(actorId: string, payload: CreateProjectPayload): Promise<{ project: InfiniteCanvasProject }> {
    await this.migrateFromLegacyJsonIfNeeded();
    return this.withProjectStoreFallback(
      async () => {
        const project = createEmptyProject(payload.projectName);

        await this.infiniteCanvasRepository.upsertOwned(project.projectId, actorId, toEntityPayload(project, actorId), { upsert: true });

        return { project };
      },
      () => this.createProjectInLocalStore(payload),
    );
  }

  public async getProject(actorId: string, projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    return this.withProjectStoreFallback(
      async () => {
        const project = await this.loadOwnedProject(projectId, actorId);

        if (!project) {
          throw new HttpError(404, 'Project not found');
        }

        return { project };
      },
      () => this.getProjectFromLocalStore(projectId),
    );
  }

  public async saveProject(actorId: string, projectId: string, payload: InfiniteCanvasProject): Promise<{ project: InfiniteCanvasProject }> {
    return this.withProjectStoreFallback(
      async () => {
        if (!payload || typeof payload !== 'object') {
          throw new HttpError(400, 'Invalid project payload');
        }

        const existing = await this.loadOwnedProject(projectId, actorId);
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

        await this.infiniteCanvasRepository.upsertOwned(projectId, actorId, toEntityPayload(next, actorId), { upsert: false });

        return { project: next };
      },
      () => this.saveProjectInLocalStore(projectId, payload),
    );
  }

  public async renameProject(actorId: string, projectId: string, projectName: string): Promise<{ project: InfiniteCanvasProject }> {
    return this.withProjectStoreFallback(
      async () => {
        const existing = await this.loadOwnedProject(projectId, actorId);

        if (!existing) {
          throw new HttpError(404, 'Project not found');
        }

        const next = normalizeProject({
          ...existing,
          projectName: trimProjectName(projectName),
          updatedAt: nowISO(),
        });

        await this.infiniteCanvasRepository.upsertOwned(projectId, actorId, toEntityPayload(next, actorId), { upsert: false });

        return { project: next };
      },
      () => this.renameProjectInLocalStore(projectId, projectName),
    );
  }

  public async duplicateProject(actorId: string, projectId: string): Promise<{ project: InfiniteCanvasProject }> {
    return this.withProjectStoreFallback(
      async () => {
        const source = await this.loadOwnedProject(projectId, actorId);

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

        await this.infiniteCanvasRepository.upsertOwned(
          duplicated.projectId,
          actorId,
          toEntityPayload(duplicated, actorId),
          { upsert: true },
        );

        return { project: duplicated };
      },
      () => this.duplicateProjectInLocalStore(projectId),
    );
  }

  public async deleteProject(actorId: string, projectId: string): Promise<{ success: true }> {
    return this.withProjectStoreFallback(
      async () => {
        const existing = await this.loadOwnedProject(projectId, actorId);
        if (!existing) {
          throw new HttpError(404, 'Project not found');
        }

        const deleted = await this.infiniteCanvasRepository.deleteOwned(projectId, actorId);

        if (!deleted) {
          throw new HttpError(404, 'Project not found');
        }

        return { success: true };
      },
      () => this.deleteProjectInLocalStore(projectId),
    );
  }

  public async reassignProjectOwner(fromUserId: string, toUserId: string): Promise<{ success: true }> {
    if (!fromUserId.trim() || !toUserId.trim() || fromUserId === toUserId) {
      return { success: true };
    }

    await this.infiniteCanvasRepository.reassignOwner(fromUserId, toUserId);

    return { success: true };
  }
}
