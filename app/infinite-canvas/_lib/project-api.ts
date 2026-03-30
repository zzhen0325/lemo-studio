import type {
  InfiniteCanvasProject,
  InfiniteCanvasProjectSummary,
} from '@/types/infinite-canvas';
import { apiBase, cleanupUndefined, requestJSON } from './api/shared';

export function listProjects() {
  return requestJSON<{ projects: InfiniteCanvasProjectSummary[] }>(`${apiBase}/infinite-canvas/projects`);
}

export function createProject(projectName?: string) {
  return requestJSON<{ project: InfiniteCanvasProject }>(`${apiBase}/infinite-canvas/projects`, {
    method: 'POST',
    body: cleanupUndefined({ projectName }),
  });
}

export function getProject(projectId: string) {
  return requestJSON<{ project: InfiniteCanvasProject }>(`${apiBase}/infinite-canvas/projects/${projectId}`);
}

export function saveProject(projectId: string, project: InfiniteCanvasProject) {
  return requestJSON<{ project: InfiniteCanvasProject }>(`${apiBase}/infinite-canvas/projects/${projectId}`, {
    method: 'PUT',
    body: project,
  });
}

export function renameProject(projectId: string, projectName: string) {
  return requestJSON<{ project: InfiniteCanvasProject }>(`${apiBase}/infinite-canvas/projects/${projectId}`, {
    method: 'PATCH',
    body: { projectName },
  });
}

export function duplicateProject(projectId: string) {
  return requestJSON<{ project: InfiniteCanvasProject }>(`${apiBase}/infinite-canvas/projects/${projectId}/duplicate`, {
    method: 'POST',
  });
}

export function deleteProject(projectId: string) {
  return requestJSON<{ success: true }>(`${apiBase}/infinite-canvas/projects/${projectId}`, {
    method: 'DELETE',
  });
}
