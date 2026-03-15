import { promises as fs } from 'fs';

export interface KoaBodyFile {
  filepath?: string;
  path?: string;
  originalFilename?: string;
  newFilename?: string;
  name?: string;
  mimetype?: string;
  type?: string;
  size?: number;
}

export interface FileLike {
  name: string;
  type: string;
  size?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

type FileCandidate = KoaBodyFile | FileLike | null | undefined;

export interface FormDataLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): any;
}

function isWebFileLike(value: FileCandidate): value is FileLike {
  return Boolean(
    value
    && typeof value === 'object'
    && 'name' in value
    && 'arrayBuffer' in value
    && typeof value.arrayBuffer === 'function',
  );
}

export function toFileLike(file?: FileCandidate | FileCandidate[]): FileLike | null {
  const f = Array.isArray(file) ? file[0] : file;
  if (!f) return null;

  if (isWebFileLike(f) && !('filepath' in f) && !('path' in f)) {
    return {
      name: f.name,
      type: f.type || 'application/octet-stream',
      size: f.size,
      arrayBuffer: async () => f.arrayBuffer(),
    };
  }

  const legacyFile = f as KoaBodyFile;
  const filepath = legacyFile.filepath || legacyFile.path;
  if (!filepath) return null;

  const name = legacyFile.originalFilename || legacyFile.newFilename || legacyFile.name || 'file';
  const type = legacyFile.mimetype || legacyFile.type || 'application/octet-stream';

  return {
    name,
    type,
    size: legacyFile.size,
    arrayBuffer: async () => {
      const buffer = await fs.readFile(filepath);
      const arr = new Uint8Array(buffer.length);
      arr.set(buffer);
      return arr.buffer;
    },
  };
}

export function toFileLikeList(file?: FileCandidate | FileCandidate[] | null): FileLike[] {
  const list = Array.isArray(file) ? file : file ? [file] : [];
  return list
    .map((item) => toFileLike(item))
    .filter((item): item is FileLike => item !== null);
}

export function buildFormDataLike(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  files?: Record<string, any>,
): FormDataLike {
  return {
    get(key: string) {
      if (files && key in files) {
        const fileLike = toFileLike(files[key]);
        if (fileLike) return fileLike;
      }

      if (!fields || !(key in fields)) return null;
      return fields[key];
    },
  };
}
