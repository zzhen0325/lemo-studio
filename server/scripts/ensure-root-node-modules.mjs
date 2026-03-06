import fs from 'node:fs';
import path from 'node:path';

const serverDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(serverDir, '..');
const serverNodeModules = path.join(serverDir, 'node_modules');
const rootNodeModules = path.join(repoRoot, 'node_modules');

if (!fs.existsSync(serverNodeModules)) {
  console.warn('[build] server/node_modules is missing, skip linking repo root node_modules');
  process.exit(0);
}

if (fs.existsSync(rootNodeModules)) {
  process.exit(0);
}

const symlinkTarget = path.relative(repoRoot, serverNodeModules);
const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';

fs.symlinkSync(symlinkTarget, rootNodeModules, symlinkType);
console.log(`[build] linked ${rootNodeModules} -> ${symlinkTarget}`);
