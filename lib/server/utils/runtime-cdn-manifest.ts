import { promises as fs } from 'fs';
import path from 'path';
import { uploadBufferToCdn } from './cdn';

export interface RuntimeCdnManifestEntry {
  file: string;
  cdnUrl: string;
  fileName: string;
  dir: string;
  size: number;
  uploadedAt: string;
}

interface RuntimeCdnManifest {
  generatedAt: string;
  entries: RuntimeCdnManifestEntry[];
}

const DEFAULT_RUNTIME_CDN_DIR = process.env.RUNTIME_CDN_DIR
  || process.env.CDN_DIR
  || 'ljhwZthlaukjlkulzlp/Lemon8_Activity/lemon8_design/runtime_assets';

function normalizeRelativeFilePath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function getManifestPathCandidates() {
  return [
    path.join(process.cwd(), 'config', 'runtime-cdn-manifest.json'),
    path.join(process.cwd(), '..', 'config', 'runtime-cdn-manifest.json'),
    path.join(__dirname, '..', '..', 'config', 'runtime-cdn-manifest.json'),
    path.join(__dirname, '..', '..', '..', 'config', 'runtime-cdn-manifest.json'),
  ];
}

async function findExistingManifestPath() {
  for (const candidate of getManifestPathCandidates()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  return getManifestPathCandidates()[0];
}

async function readManifest(): Promise<RuntimeCdnManifest> {
  const manifestPath = await findExistingManifestPath();

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<RuntimeCdnManifest>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return {
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date(0).toISOString(),
      entries: entries
        .filter((entry): entry is RuntimeCdnManifestEntry =>
          Boolean(entry)
          && typeof entry.file === 'string'
          && typeof entry.cdnUrl === 'string'
          && typeof entry.fileName === 'string'
          && typeof entry.dir === 'string'
          && typeof entry.size === 'number'
          && typeof entry.uploadedAt === 'string',
        )
        .map((entry) => ({
          ...entry,
          file: normalizeRelativeFilePath(entry.file),
        })),
    };
  } catch {
    return {
      generatedAt: new Date(0).toISOString(),
      entries: [],
    };
  }
}

async function writeManifest(manifest: RuntimeCdnManifest) {
  const manifestPath = await findExistingManifestPath();
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function buildUploadFileName(relativeFilePath: string) {
  const normalized = normalizeRelativeFilePath(relativeFilePath);
  const ext = path.extname(normalized) || '.json';
  const base = normalized.slice(0, normalized.length - ext.length).replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `${base}_${Date.now()}${ext}`;
}

export async function uploadTextAssetToRuntimeCdn(
  relativeFilePath: string,
  content: string,
  mimeType: string,
): Promise<RuntimeCdnManifestEntry> {
  const normalizedFile = normalizeRelativeFilePath(relativeFilePath);
  const buffer = Buffer.from(content, 'utf-8');
  const uploadedAt = new Date().toISOString();

  const uploaded = await uploadBufferToCdn(buffer, {
    fileName: buildUploadFileName(normalizedFile),
    dir: DEFAULT_RUNTIME_CDN_DIR,
    region: process.env.CDN_REGION || 'SG',
    mimeType,
  });

  const entry: RuntimeCdnManifestEntry = {
    file: normalizedFile,
    cdnUrl: uploaded.url || '',
    fileName: uploaded.fileName || buildUploadFileName(normalizedFile),
    dir: uploaded.dir || DEFAULT_RUNTIME_CDN_DIR,
    size: buffer.length,
    uploadedAt,
  };

  const manifest = await readManifest();
  const entries = manifest.entries.filter((item) => item.file !== normalizedFile);
  entries.push(entry);
  entries.sort((a, b) => a.file.localeCompare(b.file));

  await writeManifest({
    generatedAt: uploadedAt,
    entries,
  });

  return entry;
}
