import { lookup } from 'mime-types';
import { isLocalRuntime } from '../local-runtime';
import { LocalObjectStorageRepository, resolveLocalStorageKey } from '../repositories/local/object-storage.repository';
import { HttpError } from '../utils/http-error';

export async function readLocalStorageAsset(key: string | null) {
  if (!isLocalRuntime()) throw new HttpError(404, 'Not found');
  if (!key) throw new HttpError(400, 'Missing key');
  try { resolveLocalStorageKey(key); } catch { throw new HttpError(400, 'Invalid storage key'); }
  try {
    const buffer = await new LocalObjectStorageRepository().readFile({ fileKey: key });
    return { buffer, contentType: lookup(key) || 'application/octet-stream' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'Asset not found');
    throw error;
  }
}
