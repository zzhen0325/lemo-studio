import { NextResponse } from 'next/server';
import path from 'path';
import { datasetEvents, DATASET_SYNC_EVENT } from '@/lib/server/dataset-events';
import { createStorage } from '@/lib/storage';
import {
  DatasetDeleteSchema,
  DatasetPostSchema,
  DatasetQuerySchema,
  DatasetUpdateSchema,
  type DatasetDeleteInput,
  type DatasetPostInput,
  type DatasetQueryInput,
  type DatasetUpdateInput,
} from '@/lib/schemas/dataset';

export const dynamic = 'force-dynamic';

const storage = createStorage();

const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|webp|gif)$/i;

interface CollectionMetadata {
  prompts: Record<string, string>;
  systemPrompt: string;
  order: string[];
}

function buildPublicUrlFromKey(key: string): string {
  return storage.getPublicUrl(key.replace(/^\/+/, ''));
}

async function getMetadata(collection: string): Promise<CollectionMetadata> {
  const metaKey = `${collection}/metadata.json`;
  try {
    const buf = await storage.getObject(metaKey);
    const raw = JSON.parse(buf.toString('utf-8')) as Partial<CollectionMetadata>;
    return {
      prompts: raw.prompts || {},
      systemPrompt: raw.systemPrompt || '',
      order: Array.isArray(raw.order) ? raw.order : [],
    };
  } catch {
    return { prompts: {}, systemPrompt: '', order: [] };
  }
}

async function saveMetadata(collection: string, data: CollectionMetadata): Promise<void> {
  const metaKey = `${collection}/metadata.json`;
  const payload = JSON.stringify(
    {
      prompts: data.prompts || {},
      systemPrompt: data.systemPrompt || '',
      order: Array.isArray(data.order) ? data.order : [],
    },
    null,
    2,
  );
  await storage.putObject(metaKey, Buffer.from(payload, 'utf-8'));
}

function parseQuery<T extends DatasetQueryInput | DatasetDeleteInput>(
  schema: typeof DatasetQuerySchema | typeof DatasetDeleteSchema,
  raw: unknown,
): T | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data as T;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery: DatasetQueryInput = {
    collection: searchParams.get('collection'),
  };

  const query = parseQuery<DatasetQueryInput>(DatasetQuerySchema, rawQuery);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const collectionName = query.collection ?? null;

  try {
    if (collectionName) {
      const metadata = await getMetadata(collectionName);
      const prefix = `${collectionName}/`;
      const objects = await storage.listObjects(prefix);

      const imageObjects = objects.filter((obj) => {
        const filename = path.basename(obj.key);
        return IMAGE_EXT_REGEX.test(filename);
      });

      const images = await Promise.all(
        imageObjects.map(async (obj) => {
          const filename = path.basename(obj.key);
          let prompt = metadata.prompts[filename] || '';

          if (!prompt) {
            const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
            const txtKey = `${collectionName}/${nameWithoutExt}.txt`;
            try {
              const buf = await storage.getObject(txtKey);
              const txtContent = buf.toString('utf-8').trim();
              if (txtContent) {
                prompt = txtContent;
                metadata.prompts[filename] = prompt;
              }
            } catch {
              // ignore missing txt
            }
          }

          return {
            id: filename,
            filename,
            url: buildPublicUrlFromKey(obj.key),
            prompt,
          };
        }),
      );

      if (metadata.order && metadata.order.length > 0) {
        const orderMap = new Map(metadata.order.map((filename, index) => [filename, index] as const));
        images.sort((a, b) => {
          const indexA = orderMap.get(a.filename);
          const indexB = orderMap.get(b.filename);

          if (indexA !== undefined && indexB !== undefined) return indexA - indexB;
          if (indexA !== undefined) return -1;
          if (indexB !== undefined) return 1;
          return a.filename.localeCompare(b.filename);
        });
      } else {
        images.sort((a, b) => a.filename.localeCompare(b.filename));
      }

      if (Object.keys(metadata.prompts).length > 0) {
        await saveMetadata(collectionName, metadata);
      }

      return NextResponse.json({
        images,
        systemPrompt: metadata.systemPrompt || '',
        order: metadata.order || [],
      });
    }

    // List all collections by grouping keys on first path segment
    const objects = await storage.listObjects('');
    const collectionMap = new Map<string, string[]>();

    for (const obj of objects) {
      const parts = obj.key.split('/');
      if (parts.length < 2) continue;
      const collection = parts[0];
      const filename = parts.slice(1).join('/');
      if (!IMAGE_EXT_REGEX.test(filename)) continue;
      const list = collectionMap.get(collection) ?? [];
      list.push(filename);
      collectionMap.set(collection, list);
    }

    const collections = Array.from(collectionMap.entries()).map(([name, files]) => {
      const sorted = [...files].sort();
      const previews = sorted.slice(0, 4).map((f) => buildPublicUrlFromKey(`${name}/${f}`));
      return {
        id: name,
        name,
        imageCount: files.length,
        previews,
      };
    });

    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Dataset API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawBody: Partial<DatasetPostInput> = {
      collection: (formData.get('collection') as string) ?? undefined,
      mode: (formData.get('mode') as string) ?? undefined,
      newName: (formData.get('newName') as string) ?? undefined,
    };

    const parsed = DatasetPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      console.log('[API] /api/dataset invalid POST payload', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const file = formData.get('file') as File | null;
    const collectionName = body.collection;
    const mode = body.mode ?? undefined;

    if (mode === 'duplicate') {
      const newName = body.newName?.trim();
      if (!newName) {
        return NextResponse.json({ error: 'New collection name is required' }, { status: 400 });
      }

      const srcPrefix = `${collectionName}/`;
      const dstPrefix = `${newName}/`;

      const existing = await storage.listObjects(dstPrefix);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Collection already exists' }, { status: 409 });
      }

      const sourceObjects = await storage.listObjects(srcPrefix);
      if (sourceObjects.length === 0) {
        return NextResponse.json({ error: 'Source collection not found' }, { status: 404 });
      }

      for (const obj of sourceObjects) {
        const relative = obj.key.substring(srcPrefix.length);
        const destKey = `${dstPrefix}${relative}`;
        await storage.copyObject(obj.key, destKey);
      }

      datasetEvents.emit(DATASET_SYNC_EVENT);
      return NextResponse.json({ success: true, message: 'Collection duplicated' });
    }

    if (!file) {
      // 创建空集合：只需写入一个空的 metadata.json 即可
      const meta = await getMetadata(collectionName);
      await saveMetadata(collectionName, meta);
      datasetEvents.emit(DATASET_SYNC_EVENT);
      return NextResponse.json({ success: true, message: 'Collection created' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${collectionName}/${safeName}`;

    const result = await storage.putObject(key, buffer, { contentType: file.type });

    const metadata = await getMetadata(collectionName);
    metadata.order = metadata.order || [];
    if (!metadata.order.includes(safeName)) {
      metadata.order.push(safeName);
    }
    await saveMetadata(collectionName, metadata);

    datasetEvents.emit(DATASET_SYNC_EVENT);

    return NextResponse.json({ success: true, path: result.url ?? buildPublicUrlFromKey(key) });
  } catch (error) {
    console.error('Dataset Upload Error:', error);
    return NextResponse.json({ error: 'Upload Failed', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw: DatasetDeleteInput = {
      collection: searchParams.get('collection') ?? undefined,
      filename: searchParams.get('filename'),
      filenames: searchParams.get('filenames'),
    };

    const parsed = DatasetDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      console.log('[API] /api/dataset invalid DELETE query', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
    }

    const { collection, filename, filenames } = parsed.data;

    const collectionName = collection;

    let filenamesToDelete: string[] = [];
    if (filenames) {
      filenamesToDelete = filenames.split(',').map((f) => f.trim()).filter(Boolean);
    } else if (filename) {
      filenamesToDelete = [filename];
    }

    if (filenamesToDelete.length === 0 && !filename && !filenames) {
      // Delete entire collection
      const prefix = `${collectionName}/`;
      const objects = await storage.listObjects(prefix);
      await Promise.all(objects.map((obj) => storage.deleteObject(obj.key)));
      datasetEvents.emit(DATASET_SYNC_EVENT);
      return NextResponse.json({ success: true, message: 'Collection deleted' });
    }

    if (filenamesToDelete.length > 0) {
      const metadata = await getMetadata(collectionName);
      let metadataDirty = false;

      for (const f of filenamesToDelete) {
        const key = `${collectionName}/${f}`;
        try {
          await storage.deleteObject(key);
        } catch (e) {
          console.warn(`Could not delete image object: ${key}`, e);
        }

        if (metadata.prompts[f]) {
          delete metadata.prompts[f];
          metadataDirty = true;
        }
        if (metadata.order && metadata.order.includes(f)) {
          metadata.order = metadata.order.filter((item) => item !== f);
          metadataDirty = true;
        }
      }

      if (metadataDirty) {
        await saveMetadata(collectionName, metadata);
      }
    }

    datasetEvents.emit(DATASET_SYNC_EVENT);
    return NextResponse.json({
      success: true,
      message:
        filenamesToDelete.length > 0
          ? `Deleted ${filenamesToDelete.length} files`
          : 'Deleted successfully',
    });
  } catch (error) {
    console.error('Dataset Delete Error:', error);
    return NextResponse.json({ error: 'Delete Failed', details: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const parsed = DatasetUpdateSchema.safeParse(json);
    if (!parsed.success) {
      console.log('[API] /api/dataset invalid PUT payload', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const body: DatasetUpdateInput = parsed.data;
    const { collection, filename, prompt, systemPrompt, order, mode, prefix, newCollectionName } = body;

    const collectionName = collection;

    const metadata = await getMetadata(collectionName);

    if (filename) {
      metadata.prompts[filename] = prompt ?? '';
    }

    if (body.prompts) {
      Object.assign(metadata.prompts, body.prompts);
    }

    if (systemPrompt !== undefined) {
      metadata.systemPrompt = systemPrompt;
    }

    if (order !== undefined && Array.isArray(order)) {
      metadata.order = order;
    }

    // Batch rename within collection
    if (mode === 'batchRename') {
      if (!prefix) {
        return NextResponse.json({ error: 'Prefix is required' }, { status: 400 });
      }

      const collectionPrefix = `${collectionName}/`;
      const objects = await storage.listObjects(collectionPrefix);
      const imageFiles = objects
        .map((obj) => path.basename(obj.key))
        .filter((file) => IMAGE_EXT_REGEX.test(file));

      let sortedFiles = [...imageFiles];
      if (metadata.order && metadata.order.length > 0) {
        const orderMap = new Map(metadata.order.map((f, i) => [f, i] as const));
        sortedFiles.sort((a, b) => {
          const ia = orderMap.get(a);
          const ib = orderMap.get(b);
          if (ia !== undefined && ib !== undefined) return ia - ib;
          if (ia !== undefined) return -1;
          if (ib !== undefined) return 1;
          return a.localeCompare(b);
        });
      } else {
        sortedFiles.sort();
      }

      const newPrompts: Record<string, string> = {};
      const newOrder: string[] = [];

      for (let i = 0; i < sortedFiles.length; i++) {
        const oldName = sortedFiles[i];
        const ext = path.extname(oldName);
        const newName = `${prefix}_${String(i + 1).padStart(2, '0')}${ext}`;

        const oldKey = `${collectionName}/${oldName}`;
        const newKey = `${collectionName}/${newName}`;

        if (oldName !== newName) {
          await storage.copyObject(oldKey, newKey);
          await storage.deleteObject(oldKey);
        }

        if (metadata.prompts[oldName]) {
          newPrompts[newName] = metadata.prompts[oldName];
        }

        newOrder.push(newName);
      }

      metadata.prompts = newPrompts;
      metadata.order = newOrder;

      await saveMetadata(collectionName, metadata);
      datasetEvents.emit(DATASET_SYNC_EVENT);

      return NextResponse.json({
        success: true,
        message: `Renamed ${sortedFiles.length} files with prefix ${prefix}`,
      });
    }

    // Rename collection (prefix migration)
    if (newCollectionName && newCollectionName !== collectionName) {
      const newPrefix = `${newCollectionName}/`;
      const existing = await storage.listObjects(newPrefix);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'Collection with this name already exists' }, { status: 409 });
      }

      const oldPrefix = `${collectionName}/`;
      const objects = await storage.listObjects(oldPrefix);
      for (const obj of objects) {
        const relative = obj.key.substring(oldPrefix.length);
        const newKey = `${newPrefix}${relative}`;
        await storage.copyObject(obj.key, newKey);
        await storage.deleteObject(obj.key);
      }

      await saveMetadata(newCollectionName, metadata);
      datasetEvents.emit(DATASET_SYNC_EVENT);

      return NextResponse.json({
        success: true,
        message: 'Collection renamed and metadata updated',
        newCollectionName,
      });
    }

    await saveMetadata(collectionName, metadata);
    datasetEvents.emit(DATASET_SYNC_EVENT);

    return NextResponse.json({ success: true, message: 'Metadata updated' });
  } catch (error) {
    console.error('Dataset Update Error:', error);
    return NextResponse.json({ error: 'Update Failed', details: String(error) }, { status: 500 });
  }
}
