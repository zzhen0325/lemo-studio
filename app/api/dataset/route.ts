import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { datasetEvents, DATASET_SYNC_EVENT } from '@/lib/server/dataset-events';
import { queryDatasetCollections, queryDatasetItems } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DATASET_DIR = path.join(process.cwd(), 'public/dataset');

function isUseLocalStorage() {
    return process.env.USE_LOCAL_STORAGE === 'true';
}

// Helper to ensure directory exists
async function ensureDir(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Helper to recursively copy directory
async function copyDir(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

// Helper to get collection metadata
async function getMetadata(collectionPath: string): Promise<{ prompts: Record<string, string>, systemPrompt: string, order: string[] }> {
    const metaPath = path.join(collectionPath, 'metadata.json');
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const data = JSON.parse(content);
        return {
            prompts: data.prompts || {},
            systemPrompt: data.systemPrompt || "",
            order: Array.isArray(data.order) ? data.order : []
        };
    } catch {
        return { prompts: {}, systemPrompt: "", order: [] };
    }
}

// Helper to save collection metadata
async function saveMetadata(collectionPath: string, data: { prompts: Record<string, string>, systemPrompt?: string, order?: string[] }) {
    const metaPath = path.join(collectionPath, 'metadata.json');
    await fs.writeFile(metaPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');

    try {
        // 云端读取路径：优先从 Supabase dataset_items 表读取
        if (!isUseLocalStorage()) {
            try {
                if (collectionName) {
                    const items = await queryDatasetItems(collectionName);
                    const images = items.map((item) => ({
                        id: item.id,
                        filename: item.filename,
                        url: item.url,
                        prompt: item.prompt,
                    }));

                    return NextResponse.json({
                        images,
                        systemPrompt: "",
                        order: [],
                    });
                }

                const collections = await queryDatasetCollections();
                return NextResponse.json({ collections });
            } catch (error) {
                console.error('Dataset DB read failed, fallback to local files:', error);
                // fall through to local branch
            }
        }

        // 本地读取路径：保持原有逻辑，作为兼容回退
        await ensureDir(DATASET_DIR);

        if (collectionName) {
            // List images in a specific collection
            const collectionPath = path.join(DATASET_DIR, collectionName);
            try {
                await fs.access(collectionPath);
            } catch {
                return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
            }

            const files = await fs.readdir(collectionPath);
            const metadata = await getMetadata(collectionPath);

            // Filter image files
            const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file));

            const images = await Promise.all(imageFiles.map(async (file) => {
                let prompt = metadata.prompts[file] || "";

                // Backward compatibility: check for .txt file if not in metadata
                if (!prompt) {
                    const nameWithoutExt = file.replace(/\.[^/.]+$/, "");
                    const txtFile = `${nameWithoutExt}.txt`;
                    try {
                        const txtContent = await fs.readFile(path.join(collectionPath, txtFile), 'utf-8');
                        prompt = txtContent.trim();
                        // Optional: Migrate to metadata if found
                        if (prompt) {
                            metadata.prompts[file] = prompt;
                        }
                    } catch {
                        // No prompt found
                    }
                }

                return {
                    id: file,
                    filename: file,
                    url: `/dataset/${collectionName}/${file}`,
                    prompt
                };
            }));

            // Sort images based on metadata.order
            if (metadata.order && metadata.order.length > 0) {
                const orderMap = new Map(metadata.order.map((filename, index) => [filename, index]));
                images.sort((a, b) => {
                    const indexA = orderMap.get(a.filename);
                    const indexB = orderMap.get(b.filename);

                    // If both adhere to order, sort by index
                    if (indexA !== undefined && indexB !== undefined) {
                        return indexA - indexB;
                    }
                    // If only A in order, A comes first
                    if (indexA !== undefined) return -1;
                    // If only B in order, B comes first
                    if (indexB !== undefined) return 1;
                    // Otherwise sort by filename (default)
                    return a.filename.localeCompare(b.filename);
                });
            } else {
                // Default sort by filename if no order
                images.sort((a, b) => a.filename.localeCompare(b.filename));
            }

            // If we migrated any prompts, save it back to metadata.json
            if (Object.keys(metadata.prompts).length > 0) {
                await saveMetadata(collectionPath, metadata);
            }

            return NextResponse.json({
                images,
                systemPrompt: metadata.systemPrompt || "",
                order: metadata.order || []
            });

        } else {
            // List all collections (subdirectories)
            const items = await fs.readdir(DATASET_DIR, { withFileTypes: true });
            const collections = [];

            for (const item of items) {
                if (item.isDirectory()) {
                    const dirPath = path.join(DATASET_DIR, item.name);
                    const files = await fs.readdir(dirPath);
                    const imageCount = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length;

                    const previews = files
                        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
                        .slice(0, 4)
                        .map(f => `/dataset/${item.name}/${f}`);

                    collections.push({
                        id: item.name,
                        name: item.name,
                        imageCount,
                        previews
                    });
                }
            }

            return NextResponse.json({ collections });
        }
    } catch (error) {
        console.error('Dataset API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const collectionName = formData.get('collection') as string;
        const mode = formData.get('mode') as string;

        if (!collectionName) {
            return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
        }

        const collectionPath = path.join(DATASET_DIR, collectionName);

        if (mode === 'duplicate') {
            const newName = formData.get('newName') as string;
            if (!newName) return NextResponse.json({ error: 'New collection name is required' }, { status: 400 });
            const newPath = path.join(DATASET_DIR, newName);

            try {
                await fs.access(newPath);
                return NextResponse.json({ error: 'Collection already exists' }, { status: 409 });
            } catch {
                await copyDir(collectionPath, newPath);
                datasetEvents.emit(DATASET_SYNC_EVENT);
                return NextResponse.json({ success: true, message: 'Collection duplicated' });
            }
        }

        await ensureDir(collectionPath);

        if (!file) {
            return NextResponse.json({ success: true, message: 'Collection created', collectionPath });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(collectionPath, safeName);

        await fs.writeFile(filePath, buffer);
        datasetEvents.emit(DATASET_SYNC_EVENT);

        return NextResponse.json({ success: true, path: `/dataset/${collectionName}/${safeName}` });
    } catch (error) {
        console.error('Dataset Upload Error:', error);
        return NextResponse.json({ error: 'Upload Failed', details: String(error) }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionName = searchParams.get('collection');
        const filename = searchParams.get('filename');
        const batchFilenames = searchParams.get('filenames'); // comma separated

        if (!collectionName) {
            return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
        }

        const collectionPath = path.join(DATASET_DIR, collectionName);

        // Determine filenames to delete
        let filenamesToDelete: string[] = [];
        if (batchFilenames) {
            filenamesToDelete = batchFilenames.split(',').filter(f => f.trim() !== '');
        } else if (filename) {
            filenamesToDelete = [filename];
        }

        if (filenamesToDelete.length === 0 && !filename && !batchFilenames) {
            // Delete entire collection if no specific file/batch provided
            try {
                await fs.rm(collectionPath, { recursive: true, force: true });
                datasetEvents.emit(DATASET_SYNC_EVENT);
                return NextResponse.json({ success: true, message: 'Collection deleted' });
            } catch (e) {
                console.error("Failed to delete collection", e);
                return NextResponse.json({ error: 'Delete Collection Failed' }, { status: 500 });
            }
        }

        if (filenamesToDelete.length > 0) {
            const metadata = await getMetadata(collectionPath);
            let metadataDirty = false;

            for (const f of filenamesToDelete) {
                const filePath = path.join(collectionPath, f);
                // Delete image
                try {
                    await fs.unlink(filePath);
                } catch (e) {
                    console.warn(`Could not delete image file: ${filePath}`, e);
                }

                // Update metadata
                if (metadata.prompts[f]) {
                    delete metadata.prompts[f];
                    metadataDirty = true;
                }
                if (metadata.order && metadata.order.includes(f)) {
                    metadata.order = metadata.order.filter(item => item !== f);
                    metadataDirty = true;
                }
            }

            if (metadataDirty) {
                await saveMetadata(collectionPath, metadata);
            }
        }

        datasetEvents.emit(DATASET_SYNC_EVENT);
        return NextResponse.json({
            success: true,
            message: filenamesToDelete.length > 0 ? `Deleted ${filenamesToDelete.length} files` : 'Deleted successfully'
        });
    } catch (error) {
        console.error('Dataset Delete Error:', error);
        return NextResponse.json({ error: 'Delete Failed', details: String(error) }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { collection, filename, prompt, systemPrompt, order } = body;

        if (!collection) {
            return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
        }

        const collectionPath = path.join(DATASET_DIR, collection);
        await ensureDir(collectionPath);

        const metadata = await getMetadata(collectionPath);

        if (filename) {
            // Update individual image prompt
            metadata.prompts[filename] = prompt;
        }

        if (body.prompts) {
            // Batch update prompts
            Object.assign(metadata.prompts, body.prompts);
        }

        if (systemPrompt !== undefined) {
            // Update collection system prompt
            metadata.systemPrompt = systemPrompt;
        }

        if (order !== undefined && Array.isArray(order)) {
            // Update image order
            metadata.order = order;
        }

        if (body.mode === 'batchRename') {
            const { prefix } = body;
            if (!prefix) return NextResponse.json({ error: 'Prefix is required' }, { status: 400 });

            const files = await fs.readdir(collectionPath);
            const imageFiles = files
                .filter(file => /\.(jpg|jpeg|png|webp|gif)$/i.test(file))
                .sort(); // Sort to ensure consistent numbering 

            // NOTE: Ideally we should resort using existing metadata.order if available?
            // For now, let's keep it simple: batch rename sorts by filename alphanumeric.
            // If the user has a custom order, we might want to respect it?
            // "The user wants to rename", usually this implies a "reset" of order or 
            // the user might want to applying naming sequence based on *current visual order*.
            // Since we don't have the order in this block easily without more logic, 
            // and `imageFiles` is re-read from disk, let's respect `metadata.order` if possible.

            let sortedFiles = imageFiles;
            if (metadata.order && metadata.order.length > 0) {
                const orderMap = new Map(metadata.order.map((f, i) => [f, i]));
                sortedFiles = [...imageFiles].sort((a, b) => {
                    const ia = orderMap.get(a);
                    const ib = orderMap.get(b);
                    if (ia !== undefined && ib !== undefined) return ia - ib;
                    if (ia !== undefined) return -1;
                    if (ib !== undefined) return 1;
                    return a.localeCompare(b);
                });
            }

            const newPrompts: Record<string, string> = {};
            const newOrder: string[] = [];

            for (let i = 0; i < sortedFiles.length; i++) {
                const oldName = sortedFiles[i];
                const ext = path.extname(oldName);
                const newName = `${prefix}_${String(i + 1).padStart(2, '0')}${ext}`;

                const oldPath = path.join(collectionPath, oldName);
                const newPath = path.join(collectionPath, newName);

                if (oldName !== newName) {
                    await fs.rename(oldPath, newPath);
                }

                // Map prompt to new name
                if (metadata.prompts[oldName]) {
                    newPrompts[newName] = metadata.prompts[oldName];
                }

                newOrder.push(newName);
            }

            metadata.prompts = newPrompts;
            metadata.order = newOrder;

            await saveMetadata(collectionPath, metadata);
            datasetEvents.emit(DATASET_SYNC_EVENT);

            return NextResponse.json({
                success: true,
                message: `Renamed ${sortedFiles.length} files with prefix ${prefix}`
            });
        }

        if (body.newCollectionName && body.newCollectionName !== collection) {
            // Rename collection
            const newCollectionPath = path.join(DATASET_DIR, body.newCollectionName);
            try {
                // Check if target name already exists
                await fs.access(newCollectionPath);
                return NextResponse.json({ error: 'Collection with this name already exists' }, { status: 409 });
            } catch {
                // Rename directory
                await fs.rename(collectionPath, newCollectionPath);
                // Since we renamed, we should use the new path for saving metadata if we were to continue, 
                // but usually renaming is a standalone or final operation in this flow.
                // However, we also updated metadata object in memory. We should save it to the NEW path.
                await saveMetadata(newCollectionPath, metadata);
                datasetEvents.emit(DATASET_SYNC_EVENT);

                return NextResponse.json({
                    success: true,
                    message: 'Collection renamed and metadata updated',
                    newCollectionName: body.newCollectionName
                });
            }
        }

        await saveMetadata(collectionPath, metadata);
        datasetEvents.emit(DATASET_SYNC_EVENT);

        return NextResponse.json({ success: true, message: 'Metadata updated' });
    } catch (error) {
        console.error('Dataset Update Error:', error);
        return NextResponse.json({ error: 'Update Failed', details: String(error) }, { status: 500 });
    }
}
