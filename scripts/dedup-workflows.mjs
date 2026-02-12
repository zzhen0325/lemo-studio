#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, 'workflows');
const INDEX_PATH = path.join(WORKFLOWS_DIR, 'index.json');

function canonicalKey(name) {
  return String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function baseFromSuffix(name) {
  return name.replace(/[_\s-]\d+$/, '').trim();
}

function candidateCanonical(name) {
  if (/_\d+$/.test(name)) {
    return name.replace(/_\d+$/, '');
  }

  const withSpaces = name.replace(/_/g, ' ');
  if (withSpaces !== name) {
    return withSpaces;
  }

  return null;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function sha1(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha1').update(buf).digest('hex');
}

async function collectWorkflowDirs() {
  const entries = await fs.readdir(WORKFLOWS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

function compareKey(a, b) {
  return String(a).localeCompare(String(b));
}

const indexData = JSON.parse(await fs.readFile(INDEX_PATH, 'utf-8'));
const indexWorkflows = Array.isArray(indexData.workflows) ? indexData.workflows : [];
const workflowDirs = await collectWorkflowDirs();

const indexFolderSet = new Set(indexWorkflows.map((w) => w.folder));
const operations = [];
const issues = [];

for (const dirName of workflowDirs.sort(compareKey)) {
  const preferred = candidateCanonical(dirName);
  if (!preferred) continue;

  let canonical = preferred;

  // If canonical folder is not present, try finding by normalized key from index first.
  if (!workflowDirs.includes(canonical)) {
    const key = canonicalKey(baseFromSuffix(dirName));
    const inIndex = indexWorkflows.find((w) => canonicalKey(w.folder) === key);
    if (inIndex?.folder) {
      canonical = inIndex.folder;
    }
  }

  if (!canonical || canonical === dirName) continue;
  if (!(await exists(path.join(WORKFLOWS_DIR, canonical)))) continue;

  const duplicateConfig = path.join(WORKFLOWS_DIR, dirName, 'config.json');
  const duplicateWorkflow = path.join(WORKFLOWS_DIR, dirName, 'workflow.json');
  const canonicalConfig = path.join(WORKFLOWS_DIR, canonical, 'config.json');
  const canonicalWorkflow = path.join(WORKFLOWS_DIR, canonical, 'workflow.json');

  if (!(await exists(duplicateWorkflow)) || !(await exists(canonicalWorkflow))) {
    issues.push(`[SKIP] ${dirName} -> ${canonical}: missing workflow.json`);
    continue;
  }

  const sameWorkflow = (await sha1(duplicateWorkflow)) === (await sha1(canonicalWorkflow));
  if (!sameWorkflow) {
    issues.push(`[SKIP] ${dirName} -> ${canonical}: workflow.json differs, manual review required`);
    continue;
  }

  let sameConfig = false;
  if ((await exists(duplicateConfig)) && (await exists(canonicalConfig))) {
    sameConfig = (await sha1(duplicateConfig)) === (await sha1(canonicalConfig));
  }

  operations.push({
    duplicate: dirName,
    canonical,
    sameWorkflow,
    sameConfig,
  });
}

if (operations.length === 0) {
  console.log('[dedup-workflows] No duplicate families eligible for cleanup.');
  process.exit(0);
}

console.log('[dedup-workflows] Planned operations:');
for (const op of operations) {
  console.log(`- ${op.duplicate} -> ${op.canonical} (workflow same: ${op.sameWorkflow}, config same: ${op.sameConfig})`);
}
if (issues.length > 0) {
  console.log('\n[dedup-workflows] Skipped:');
  for (const line of issues) console.log(`- ${line}`);
}

if (!apply) {
  console.log('\n[dedup-workflows] Dry run. Re-run with --apply to execute.');
  process.exit(0);
}

const duplicateToCanonical = new Map(operations.map((op) => [op.duplicate, op.canonical]));
const nextWorkflows = [];
const seen = new Set();

for (const workflow of indexWorkflows) {
  const nextFolder = duplicateToCanonical.get(workflow.folder) || workflow.folder;
  const dedupKey = `${workflow.id}::${nextFolder}`;
  if (seen.has(dedupKey)) {
    continue;
  }
  seen.add(dedupKey);
  nextWorkflows.push({ ...workflow, folder: nextFolder });
}

indexData.workflows = nextWorkflows;
await fs.writeFile(INDEX_PATH, JSON.stringify(indexData, null, 2), 'utf-8');

for (const op of operations) {
  const fromDir = path.join(WORKFLOWS_DIR, op.duplicate);
  await fs.rm(fromDir, { recursive: true, force: true });
}

console.log(`\n[dedup-workflows] Applied. Removed ${operations.length} duplicate directories and updated index.`);
