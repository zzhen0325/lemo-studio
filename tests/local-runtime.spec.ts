// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalObjectStorageRepository, resolveLocalStorageKey } from '@/lib/server/repositories/local/object-storage.repository';
import { getLocalDatabaseClient } from '@/lib/server/repositories/local/database-client';
import { extractLocalStorageKey } from '@/lib/local-storage-url';
import { readLocalStorageAsset } from '@/lib/server/service/local-storage.service';

let temporary: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (temporary) await rm(temporary, { recursive: true, force: true });
  temporary = undefined;
});

describe('local runtime boundaries', () => {
  it('recovers a durable key after the app changes port', () => {
    expect(extractLocalStorageKey('http://127.0.0.1:3002/api/storage/local?key=upload%2Fa.png')).toBe('upload/a.png');
    expect(extractLocalStorageKey('https://example.com/api/storage/local?key=upload%2Fa.png')).toBeNull();
  });
  it('persists image bytes across repository instances and deletes only the selected file', async () => {
    temporary = await mkdtemp(path.join(tmpdir(), 'studio-storage-'));
    vi.stubEnv('LOCAL_STORAGE_DIR', temporary);
    vi.stubEnv('STUDIO_RUNTIME', 'local');
    vi.stubEnv('APP_PORT', '3002');
    const key = 'ljhwZthlaukjlkulzlp/upload/test.png';
    const repository = new LocalObjectStorageRepository();
    await repository.uploadFile({ fileName: key, fileContent: Buffer.from('image bytes') });
    expect((await readLocalStorageAsset(key)).buffer.toString()).toBe('image bytes');
    expect(await new LocalObjectStorageRepository().generatePresignedUrl({ key })).toContain('http://127.0.0.1:3002/api/storage/local?key=');
    expect(await repository.deleteFile({ fileKey: key })).toBe(true);
    expect(await repository.fileExists({ fileKey: key })).toBe(false);
    await expect(readLocalStorageAsset(key)).rejects.toMatchObject({ status: 404 });
  });

  it.each(['../.env.local', '/etc/passwd', 'upload/../../secret', 'upload\\secret', 'upload/\0bad'])('rejects unsafe key %s', key => {
    expect(() => resolveLocalStorageKey(key)).toThrow('Invalid local storage key');
  });

  it('does not expose local files in cloud mode', async () => {
    vi.stubEnv('STUDIO_RUNTIME', 'coze');
    await expect(readLocalStorageAsset('test.png')).rejects.toMatchObject({ status: 404 });
  });

  it('uses the real local PostgREST protocol without forwarding cloud credentials', async () => {
    vi.stubEnv('LOCAL_DATABASE_API_URL', 'http://127.0.0.1:54321');
    const fetcher = vi.fn(async () => Response.json([{ id: 'test' }]));
    vi.stubGlobal('fetch', fetcher);
    const { data, error } = await getLocalDatabaseClient().from('generations').select('id').eq('user_id', 'owner');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 'test' }]);
    const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe('/generations');
    expect(url.searchParams.get('user_id')).toBe('eq.owner');
    expect(new Headers(options.headers).has('authorization')).toBe(false);
  });

  it('refuses a remote database endpoint in local mode', () => {
    vi.stubEnv('LOCAL_DATABASE_API_URL', 'https://example.com');
    expect(() => getLocalDatabaseClient()).toThrow('loopback');
  });
});
