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

export interface FormDataLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): any;
}

export function toFileLike(file?: KoaBodyFile | KoaBodyFile[] | null): FileLike | null {
  const f = Array.isArray(file) ? file[0] : file;
  if (!f) return null;

  const filepath = f.filepath || f.path;
  if (!filepath) return null;

  const name = f.originalFilename || f.newFilename || f.name || 'file';
  const type = f.mimetype || f.type || 'application/octet-stream';

  return {
    name,
    type,
    size: f.size,
    arrayBuffer: async () => {
      const buffer = await fs.readFile(filepath);
      const arr = new Uint8Array(buffer.length);
      arr.set(buffer);
      return arr.buffer;
    },
  };
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

