import { promises as fs } from 'fs';
import path from 'path';

interface CdnManifestEntry {
  file?: string;
  cdnUrl?: string;
}

interface CdnManifest {
  entries?: CdnManifestEntry[];
}

interface ExternalAssetRedirect {
  source?: string;
  destination?: string;
}

const MANIFEST_CANDIDATES = [
  path.join('config', 'runtime-cdn-manifest.json'),
  path.join('config', 'cdn-assets-manifest.json'),
];

const REDIRECT_CANDIDATES = [
  path.join('config', 'external-asset-redirects.json'),
];

let manifestCache: Promise<Map<string, string>> | null = null;
let redirectCache: Promise<Map<string, string>> | null = null;

function normalizeRelativeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizePublicPath(publicPath: string): string {
  const trimmed = publicPath.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getCandidateRoots() {
  const rawRoots = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
  ];

  return [...new Set(rawRoots.map((root) => path.resolve(root)))];
}

async function findSupportingFile(relativeFilePath: string): Promise<string | undefined> {
  const normalized = normalizeRelativeFilePath(relativeFilePath);
  if (!normalized) return undefined;

  for (const root of getCandidateRoots()) {
    const candidate = path.join(root, normalized);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next path
    }
  }

  return undefined;
}

async function loadManifestMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const manifestPath of MANIFEST_CANDIDATES) {
    const existingPath = await findSupportingFile(manifestPath);
    if (!existingPath) continue;

    try {
      const content = await fs.readFile(existingPath, 'utf-8');
      const parsed = JSON.parse(content) as CdnManifest;
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      for (const entry of entries) {
        const file = typeof entry.file === 'string' ? normalizeRelativeFilePath(entry.file) : '';
        const cdnUrl = typeof entry.cdnUrl === 'string' ? entry.cdnUrl.trim() : '';
        if (!file || !cdnUrl) continue;
        map.set(file, cdnUrl);
      }
    } catch (error) {
      console.warn(`[runtime-assets] Failed to parse manifest ${manifestPath}:`, error);
    }
  }

  return map;
}

async function loadRedirectMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const redirectsPath of REDIRECT_CANDIDATES) {
    const existingPath = await findSupportingFile(redirectsPath);
    if (!existingPath) continue;

    try {
      const content = await fs.readFile(existingPath, 'utf-8');
      const parsed = JSON.parse(content) as ExternalAssetRedirect[];
      const entries = Array.isArray(parsed) ? parsed : [];
      for (const entry of entries) {
        const source = typeof entry.source === 'string' ? normalizePublicPath(entry.source) : '';
        const destination = typeof entry.destination === 'string' ? entry.destination.trim() : '';
        if (!source || !destination) continue;
        map.set(source, destination);
      }
    } catch (error) {
      console.warn(`[runtime-assets] Failed to parse redirects ${redirectsPath}:`, error);
    }
  }

  return map;
}

async function getManifestMap() {
  if (!manifestCache) {
    manifestCache = loadManifestMap();
  }
  return manifestCache;
}

async function getRedirectMap() {
  if (!redirectCache) {
    redirectCache = loadRedirectMap();
  }
  return redirectCache;
}

export async function getCdnUrlForFile(relativeFilePath: string): Promise<string | undefined> {
  const manifest = await getManifestMap();
  return manifest.get(normalizeRelativeFilePath(relativeFilePath));
}

export async function resolvePublicAssetUrl(publicPath: string): Promise<string | undefined> {
  const normalized = normalizePublicPath(publicPath);
  if (!normalized) return undefined;

  const redirects = await getRedirectMap();
  const redirectTarget = redirects.get(normalized);
  if (redirectTarget) {
    return redirectTarget;
  }

  const manifestFile = normalized.startsWith('/')
    ? `public${normalized}`
    : `public/${normalized}`;
  return getCdnUrlForFile(manifestFile);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
}

async function readLocalTextAsset(relativeFilePath: string): Promise<string | undefined> {
  const existingPath = await findSupportingFile(relativeFilePath);
  if (!existingPath) {
    return undefined;
  }

  return fs.readFile(existingPath, 'utf-8');
}

export async function readTextAsset(relativeFilePath: string): Promise<string> {
  const cdnUrl = await getCdnUrlForFile(relativeFilePath);
  if (cdnUrl) {
    try {
      return await fetchText(cdnUrl);
    } catch (error) {
      const localContent = await readLocalTextAsset(relativeFilePath);
      if (typeof localContent === 'string') {
        console.warn(`[runtime-assets] Falling back to local asset for ${normalizeRelativeFilePath(relativeFilePath)} after CDN fetch failure:`, error);
        return localContent;
      }
      throw error;
    }
  }

  const localContent = await readLocalTextAsset(relativeFilePath);
  if (typeof localContent === 'string') {
    return localContent;
  }

  throw new Error(`CDN asset not found in manifest: ${normalizeRelativeFilePath(relativeFilePath)}`);
}

export async function readJsonAsset<T>(relativeFilePath: string): Promise<T> {
  const content = await readTextAsset(relativeFilePath);
  return JSON.parse(content) as T;
}

export function resetRuntimeAssetCaches() {
  manifestCache = null;
  redirectCache = null;
}
