import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { LocalStorage } from '@/lib/storage/local';

const TMP_PREFIX = 'lemon8-local-storage-';

let tmpRoot: string;
let storage: LocalStorage;

describe('LocalStorage (IStorage local implementation)', () => {
  beforeEach(async () => {
    if (!tmpRoot) {
      tmpRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
    } else {
      await fs.rm(tmpRoot, { recursive: true, force: true });
      await fs.mkdir(tmpRoot, { recursive: true });
    }
    storage = new LocalStorage(tmpRoot);
    delete process.env.CLOUD_PUBLIC_BASE;
  });

  afterAll(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('puts, gets, lists, copies and deletes objects correctly', async () => {
    // putObject
    await storage.putObject('collection-a/file1.txt', Buffer.from('hello')); 

    // getObject
    const buf = await storage.getObject('collection-a/file1.txt');
    expect(buf.toString('utf-8')).toBe('hello');

    // listObjects
    const listed = await storage.listObjects('collection-a');
    expect(listed.length).toBe(1);
    expect(listed[0].key).toBe('collection-a/file1.txt');
    expect(listed[0].size).toBe(5);

    // copyObject
    await storage.copyObject('collection-a/file1.txt', 'collection-a/file2.txt');
    const copied = await storage.getObject('collection-a/file2.txt');
    expect(copied.toString('utf-8')).toBe('hello');

    // deleteObject
    await storage.deleteObject('collection-a/file1.txt');
    const afterDelete = await storage.listObjects('collection-a');
    const keys = afterDelete.map((o) => o.key).sort();
    expect(keys).toEqual(['collection-a/file2.txt']);
  });

  it('builds public URL with default /dataset prefix when CLOUD_PUBLIC_BASE is not set', async () => {
    const url = storage.getPublicUrl('collection-a/image.png');
    expect(url).toBe('/dataset/collection-a/image.png');
  });

  it('builds public URL based on CLOUD_PUBLIC_BASE when provided', async () => {
    process.env.CLOUD_PUBLIC_BASE = 'https://cdn.example.com/base/';
    const url = storage.getPublicUrl('/collection-a/image.png');
    expect(url).toBe('https://cdn.example.com/base/collection-a/image.png');
  });
});
