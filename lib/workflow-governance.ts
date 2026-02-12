export interface WorkflowIndexItem {
  title: string;
  folder: string;
  id: string;
}

export interface WorkflowIndexData {
  appTitle: string;
  appImg: string;
  workflows: WorkflowIndexItem[];
}

export interface WorkflowGovernanceIssue {
  level: 'warn' | 'error';
  code: string;
  message: string;
}

const INVALID_FOLDER_CHARS = /[<>:"/\\|?*]/g;

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function slugifyId(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'workflow';
}

export function sanitizeWorkflowFolderName(value: string): string {
  const normalized = normalizeSpaces(String(value || '').replace(INVALID_FOLDER_CHARS, '_'));
  return normalized || `workflow_${Date.now()}`;
}

export function buildWorkflowId(folderName: string): string {
  return `wf_${slugifyId(folderName)}`;
}

function ensureUnique(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let counter = 2;
  while (used.has(`${base}_${counter}`)) {
    counter += 1;
  }

  const uniqueValue = `${base}_${counter}`;
  used.add(uniqueValue);
  return uniqueValue;
}

export function governWorkflowIndex(indexData: WorkflowIndexData): {
  normalized: WorkflowIndexData;
  issues: WorkflowGovernanceIssue[];
  changed: boolean;
} {
  const issues: WorkflowGovernanceIssue[] = [];
  const usedFolders = new Set<string>();
  const usedIds = new Set<string>();

  const normalizedWorkflows: WorkflowIndexItem[] = [];
  for (const entry of indexData.workflows || []) {
    const rawTitle = normalizeSpaces(entry?.title || '');
    const rawFolder = sanitizeWorkflowFolderName(entry?.folder || rawTitle);
    const rawId = normalizeSpaces(entry?.id || '');

    if (!rawFolder) {
      issues.push({
        level: 'error',
        code: 'INVALID_FOLDER',
        message: 'Skipped one workflow because folder is empty after normalization.',
      });
      continue;
    }

    if (usedFolders.has(rawFolder)) {
      issues.push({
        level: 'warn',
        code: 'DUPLICATE_FOLDER',
        message: `Duplicate workflow folder "${rawFolder}" found in index; keeping the first entry and dropping the duplicate.`,
      });
      continue;
    }
    usedFolders.add(rawFolder);

    const id = rawId || buildWorkflowId(rawFolder);
    if (usedIds.has(id)) {
      issues.push({
        level: 'warn',
        code: 'DUPLICATE_ID',
        message: `Duplicate workflow id "${id}" found in index; keeping the first entry and dropping the duplicate.`,
      });
      continue;
    }
    usedIds.add(id);

    normalizedWorkflows.push({
      title: rawTitle || rawFolder,
      folder: rawFolder,
      id,
    });
  }

  const normalized: WorkflowIndexData = {
    appTitle: indexData.appTitle || 'ViewComfy',
    appImg: indexData.appImg || '',
    workflows: normalizedWorkflows,
  };

  const changed = JSON.stringify(normalized) !== JSON.stringify(indexData);
  return { normalized, issues, changed };
}

export function createGovernedWorkflowEntry(
  title: string,
  usedFolders: Set<string>,
  usedIds: Set<string>,
): WorkflowIndexItem {
  const folderBase = sanitizeWorkflowFolderName(title);
  const folder = ensureUnique(folderBase, usedFolders);

  const idBase = buildWorkflowId(folder);
  const id = ensureUnique(idBase, usedIds);

  return {
    title: normalizeSpaces(title) || folder,
    folder,
    id,
  };
}
