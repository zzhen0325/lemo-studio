#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CLIENT_DIRS = ['app', 'components', 'hooks', 'lib'];
const ROUTES_DIR = path.join(ROOT, 'app', 'api');
const REPORT_DIR = path.join(ROOT, 'report');
const REPORT_JSON = path.join(REPORT_DIR, 'api-coverage.json');
const REPORT_MD = path.join(REPORT_DIR, 'api-coverage.md');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name.startsWith('.')) {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, out);
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(abs);
    }
  }
  return out;
}

function normalizePath(inputPath) {
  let value = inputPath.trim();
  value = value.replace(/\$\{[^}]+\}/g, ':param');
  value = value.split('?')[0];
  value = value.replace(/\/+/g, '/');
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }
  if (value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePatternToRegex(routePattern) {
  const parts = routePattern.split('/').map((segment) => {
    if (!segment) return '';
    if (segment.startsWith(':')) return '[^/]+';
    return escapeRegex(segment);
  });
  return new RegExp(`^${parts.join('/')}$`);
}

function collectClientEndpoints() {
  const endpointRegex = /\$\{getApiBase\(\)\}\/([^`"'\s)]+)/g;
  const endpoints = [];

  for (const relativeDir of CLIENT_DIRS) {
    const absDir = path.join(ROOT, relativeDir);
    const files = walkFiles(absDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        endpointRegex.lastIndex = 0;
        let match;
        while ((match = endpointRegex.exec(line)) !== null) {
          const raw = match[1];
          const endpointPath = normalizePath(raw);
          endpoints.push({
            endpointPath,
            file: path.relative(ROOT, file),
            line: index + 1,
          });
        }
      });
    }
  }

  return endpoints;
}

function combineRoute(base, sub = '') {
  const b = normalizePath(base);
  if (!sub) return b;
  return normalizePath(`${b}/${sub}`);
}

function collectServerRoutes() {
  if (!fs.existsSync(ROUTES_DIR)) return [];

  const files = walkFiles(ROUTES_DIR).filter((file) => file.endsWith(`${path.sep}route.ts`) || file.endsWith(`${path.sep}route.js`));

  const routeRecords = [];
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(ROUTES_DIR, file);
    const routePath = relativeFile
      .replace(new RegExp(`${escapeRegex(`${path.sep}route.ts`)}$`), '')
      .replace(new RegExp(`${escapeRegex(`${path.sep}route.js`)}$`), '')
      .split(path.sep)
      .map((segment) => {
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return ':param';
        }
        return segment;
      })
      .join('/');

    let methodMatch;
    while ((methodMatch = methodRegex.exec(content)) !== null) {
      routeRecords.push({
        method: methodMatch[1].toUpperCase(),
        endpointPath: combineRoute(routePath),
        file: path.relative(ROOT, file),
      });
    }
  }

  return routeRecords;
}

function buildMissingEndpoints(clientEndpoints, serverRoutes) {
  const uniqueServerPaths = Array.from(new Set(serverRoutes.map((route) => route.endpointPath)));
  const serverMatchers = uniqueServerPaths.map((routePath) => ({
    routePath,
    pattern: routePatternToRegex(routePath),
  }));

  const missingByEndpoint = new Map();
  for (const endpoint of clientEndpoints) {
    const matched = serverMatchers.some(({ pattern }) => pattern.test(endpoint.endpointPath));
    if (matched) continue;

    if (!missingByEndpoint.has(endpoint.endpointPath)) {
      missingByEndpoint.set(endpoint.endpointPath, []);
    }
    missingByEndpoint.get(endpoint.endpointPath).push({
      file: endpoint.file,
      line: endpoint.line,
    });
  }

  return Array.from(missingByEndpoint.entries()).map(([endpointPath, occurrences]) => ({
    endpointPath,
    occurrences,
  }));
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push('# API Coverage Report');
  lines.push('');
  lines.push(`Generated at: ${summary.generatedAt}`);
  lines.push('');
  lines.push(`- Client endpoint references: ${summary.clientEndpointsCount}`);
  lines.push(`- Unique client endpoints: ${summary.uniqueClientEndpointsCount}`);
  lines.push(`- Server routes: ${summary.serverRoutesCount}`);
  lines.push(`- Missing endpoints: ${summary.missingCount}`);
  lines.push('');

  if (summary.missingCount === 0) {
    lines.push('No missing endpoint mappings found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Missing Endpoints');
  lines.push('');
  lines.push('| Endpoint | Occurrences |');
  lines.push('| --- | --- |');
  for (const missing of summary.missing) {
    const refs = missing.occurrences.map((item) => `\`${item.file}:${item.line}\``).join('<br/>');
    lines.push(`| \`${missing.endpointPath}\` | ${refs} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  ensureReportDir();

  const clientEndpoints = collectClientEndpoints();
  const serverRoutes = collectServerRoutes();
  const missing = buildMissingEndpoints(clientEndpoints, serverRoutes);

  const summary = {
    generatedAt: new Date().toISOString(),
    clientEndpointsCount: clientEndpoints.length,
    uniqueClientEndpointsCount: new Set(clientEndpoints.map((item) => item.endpointPath)).size,
    serverRoutesCount: serverRoutes.length,
    missingCount: missing.length,
    missing,
    clientEndpoints,
    serverRoutes,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(REPORT_MD, buildMarkdownReport(summary));

  if (missing.length > 0) {
    console.error(`[check-api-coverage] Missing endpoint mappings found: ${missing.length}`);
    console.error(`[check-api-coverage] Report: ${path.relative(ROOT, REPORT_MD)}`);
    process.exit(1);
  }

  console.log('[check-api-coverage] All frontend endpoints are mapped to Next route handlers.');
  console.log(`[check-api-coverage] Report: ${path.relative(ROOT, REPORT_MD)}`);
}

main();
