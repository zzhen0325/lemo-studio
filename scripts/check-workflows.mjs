#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const failOnWarn = args.has('--fail-on-warn');
const fix = args.has('--fix');

const roots = [
  { name: 'app', dir: 'workflows' },
  { name: 'server', dir: 'server/workflows' },
];

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeFolder(value) {
  const normalized = normalizeSpaces(String(value || '').replace(/[<>:"/\\|?*]/g, '_'));
  return normalized || 'untitled_workflow';
}

function buildId(folder) {
  return `wf_${folder
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'workflow'}`;
}

function canonicalWorkflowName(name) {
  return normalizeSpaces(name)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/(?:[_\s-]\d+)$/g, '');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listWorkflowDirs(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

const issues = [];

for (const root of roots) {
  const rootDir = path.join(process.cwd(), root.dir);
  const indexPath = path.join(rootDir, 'index.json');

  if (!(await exists(rootDir))) {
    issues.push(`[ERROR][${root.name}] Missing workflows directory: ${root.dir}`);
    continue;
  }

  const folderNames = await listWorkflowDirs(rootDir);
  const canonicalMap = new Map();
  for (const folder of folderNames) {
    const key = canonicalWorkflowName(folder);
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, []);
    }
    canonicalMap.get(key).push(folder);
  }

  for (const [key, values] of canonicalMap) {
    if (key && values.length > 1) {
      issues.push(`[WARN][${root.name}] Potential duplicate workflow folders (${values.join(', ')}) share canonical key "${key}"`);
    }
  }

  if (!(await exists(indexPath))) {
    issues.push(`[ERROR][${root.name}] Missing index file: ${path.relative(process.cwd(), indexPath)}`);
    continue;
  }

  let indexData;
  try {
    indexData = await readJson(indexPath);
  } catch (error) {
    issues.push(`[ERROR][${root.name}] Invalid JSON in index file: ${error}`);
    continue;
  }

  const sourceEntries = Array.isArray(indexData.workflows) ? indexData.workflows : [];
  const usedFolders = new Set();
  const usedIds = new Set();
  const normalizedEntries = [];

  for (const item of sourceEntries) {
    const folderBase = sanitizeFolder(item?.folder || item?.title);
    if (usedFolders.has(folderBase)) {
      issues.push(`[WARN][${root.name}] Duplicate folder in index dropped: ${folderBase}`);
      continue;
    }
    usedFolders.add(folderBase);

    const id = normalizeSpaces(item?.id) || buildId(folderBase);
    if (usedIds.has(id)) {
      issues.push(`[WARN][${root.name}] Duplicate id in index dropped: ${id}`);
      continue;
    }
    usedIds.add(id);

    const title = normalizeSpaces(item?.title) || folderBase;

    const workflowDir = path.join(rootDir, folderBase);
    if (!(await exists(workflowDir))) {
      issues.push(`[ERROR][${root.name}] Index points to missing folder: ${folderBase}`);
      continue;
    }

    const configPath = path.join(workflowDir, 'config.json');
    const workflowPath = path.join(workflowDir, 'workflow.json');

    if (!(await exists(configPath))) {
      issues.push(`[ERROR][${root.name}] Missing config.json for ${folderBase}`);
      continue;
    }

    if (!(await exists(workflowPath))) {
      issues.push(`[ERROR][${root.name}] Missing workflow.json for ${folderBase}`);
      continue;
    }

    normalizedEntries.push({ title, folder: folderBase, id });

    try {
      const config = await readJson(configPath);
      if (config.id !== id || config.title !== title) {
        issues.push(`[WARN][${root.name}] Config metadata drift in ${folderBase} (id/title out of sync with index)`);
        if (fix) {
          const nextConfig = { ...config, id, title };
          await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2), 'utf-8');
        }
      }
    } catch (error) {
      issues.push(`[ERROR][${root.name}] Invalid config.json in ${folderBase}: ${error}`);
    }
  }

  const normalizedIndex = {
    appTitle: String(indexData.appTitle || 'ViewComfy'),
    appImg: String(indexData.appImg || ''),
    workflows: normalizedEntries,
  };

  if (fix) {
    await fs.writeFile(indexPath, JSON.stringify(normalizedIndex, null, 2), 'utf-8');
  }
}

const errorCount = issues.filter((line) => line.includes('[ERROR]')).length;
const warnCount = issues.filter((line) => line.includes('[WARN]')).length;

if (issues.length === 0) {
  console.log('[check-workflows] No governance issues found.');
} else {
  for (const issue of issues) {
    console.log(issue);
  }
  console.log(`\n[check-workflows] Summary: ${errorCount} error(s), ${warnCount} warning(s).`);
}

if (strict && errorCount > 0) {
  process.exit(1);
}

if (failOnWarn && (errorCount > 0 || warnCount > 0)) {
  process.exit(1);
}

if (!strict && errorCount > 0) {
  process.exit(1);
}
