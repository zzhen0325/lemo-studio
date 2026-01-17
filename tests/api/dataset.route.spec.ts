import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorage } from '@/lib/storage/local';

function createJsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('/api/dataset route', () => {
  let datasetRoot: string;
  let storage: LocalStorage;

  async function importRoutes() {
    // 每次测试前都通过 resetModules 重新加载路由，确保使用新的 DATASET_DIR
    vi.resetModules();
    const mod = await import('../../app/api/dataset/route');
    return mod;
  }

  beforeEach(async () => {
    datasetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lemon8-dataset-tests-'));
    process.env.DATASET_DIR = datasetRoot;
    process.env.CLOUD_STORAGE = 'local';
    storage = new LocalStorage(datasetRoot);
  });

  afterEach(async () => {
    await fs.rm(datasetRoot, { recursive: true, force: true });
    delete process.env.DATASET_DIR;
    delete process.env.CLOUD_STORAGE;
  });

  it('GET returns empty collections when no objects exist', async () => {
    const { GET } = await importRoutes();

    const req = new Request('http://localhost/api/dataset');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { collections: unknown[] };
    expect(json.collections).toEqual([]);
  });

  it('GET with collection returns images with metadata and urls', async () => {
    const collection = 'set-1';

    await storage.putObject(`${collection}/image1.jpg`, Buffer.from('image-binary'));
    await storage.putObject(
      `${collection}/metadata.json`,
      Buffer.from(
        JSON.stringify({
          prompts: { 'image1.jpg': 'a prompt' },
          systemPrompt: 'system',
          order: ['image1.jpg'],
        }),
        'utf-8',
      ),
    );

    const { GET } = await importRoutes();

    const req = new Request(`http://localhost/api/dataset?collection=${collection}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      images: { filename: string; url: string; prompt: string }[];
      systemPrompt: string;
      order: string[];
    };

    expect(json.images).toHaveLength(1);
    expect(json.images[0]).toMatchObject({
      filename: 'image1.jpg',
      url: `/dataset/${collection}/image1.jpg`,
      prompt: 'a prompt',
    });
    expect(json.systemPrompt).toBe('system');
    expect(json.order).toEqual(['image1.jpg']);
  });

  it('POST without file creates empty collection and metadata', async () => {
    const { POST } = await importRoutes();

    const formData = new FormData();
    formData.set('collection', 'set-1');

    const req = new Request('http://localhost/api/dataset', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toBe('Collection created');

    const objects = await storage.listObjects('set-1/');
    const keys = objects.map((o) => o.key).sort();
    expect(keys).toContain('set-1/metadata.json');
  });

  it('POST with file uploads object and returns public path', async () => {
    const { POST } = await importRoutes();

    const formData = new FormData();
    formData.set('collection', 'set-1');

    const blob = new Blob(['hello image'], { type: 'image/png' });
    formData.append('file', blob, 'img1.png');

    const req = new Request('http://localhost/api/dataset', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; path: string };
    expect(json.success).toBe(true);
    expect(json.path).toMatch(/^\/dataset\/set-1\//);

    const objects = await storage.listObjects('set-1/');
    const keys = objects.map((o) => o.key).sort();
    const keyFromPath = json.path.replace(/^\/dataset\//, '');
    expect(keys).toContain(keyFromPath);
  });

  it('DELETE with filenames deletes those files and updates message', async () => {
    const collection = 'set-1';
    await storage.putObject(`${collection}/a.jpg`, Buffer.from('a'));
    await storage.putObject(`${collection}/b.jpg`, Buffer.from('b'));
    await storage.putObject(`${collection}/c.jpg`, Buffer.from('c'));

    const { DELETE } = await importRoutes();

    const req = new Request(
      `http://localhost/api/dataset?collection=${collection}&filenames=a.jpg,b.jpg,,c.jpg,`,
      { method: 'DELETE' },
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toBe('Deleted 3 files');

    const remaining = await storage.listObjects(`${collection}/`);
    const remainingImageKeys = remaining.filter((o) => o.key.endsWith('.jpg'));
    expect(remainingImageKeys.length).toBe(0);
  });

  it('PUT with batchRename renames images with prefix and preserves count', async () => {
    const collection = 'set-1';
    await storage.putObject(`${collection}/b.jpg`, Buffer.from('b'));
    await storage.putObject(`${collection}/a.jpg`, Buffer.from('a'));

    await storage.putObject(
      `${collection}/metadata.json`,
      Buffer.from(
        JSON.stringify({
          prompts: { 'a.jpg': 'pa', 'b.jpg': 'pb' },
          systemPrompt: 'sys',
          order: ['b.jpg', 'a.jpg'],
        }),
        'utf-8',
      ),
    );

    const { PUT } = await importRoutes();

    const req = createJsonRequest('http://localhost/api/dataset', 'PUT', {
      collection,
      mode: 'batchRename',
      prefix: 'demo',
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toContain('Renamed 2 files with prefix demo');

    const objects = await storage.listObjects(`${collection}/`);
    const keys = objects.map((o) => o.key).sort();
    expect(keys).toContain('set-1/demo_01.jpg');
    expect(keys).toContain('set-1/demo_02.jpg');
  });

  it('PUT with renameCollection migrates all keys to new prefix', async () => {
    const collection = 'old-set';
    await storage.putObject(`${collection}/img1.png`, Buffer.from('1'));
    await storage.putObject(`${collection}/img2.png`, Buffer.from('2'));
    await storage.putObject(
      `${collection}/metadata.json`,
      Buffer.from(JSON.stringify({ prompts: {}, systemPrompt: '', order: [] }), 'utf-8'),
    );

    const { PUT } = await importRoutes();

    const req = createJsonRequest('http://localhost/api/dataset', 'PUT', {
      collection,
      newCollectionName: 'new-set',
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; newCollectionName?: string };
    expect(json.newCollectionName).toBe('new-set');

    const oldObjects = await storage.listObjects('old-set/');
    expect(oldObjects.length).toBe(0);

    const newObjects = await storage.listObjects('new-set/');
    const newKeys = newObjects.map((o) => o.key).sort();
    expect(newKeys).toEqual([
      'new-set/img1.png',
      'new-set/img2.png',
      'new-set/metadata.json',
    ]);
  });

  it('returns 400 on invalid PUT payload (missing collection)', async () => {
    const { PUT } = await importRoutes();

    const req = createJsonRequest('http://localhost/api/dataset', 'PUT', {
      // collection is missing
      mode: 'batchRename',
      prefix: 'demo',
    });

    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid payload');
  });
});
