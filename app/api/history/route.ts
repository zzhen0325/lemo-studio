import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Generation, GenerationConfig } from '@/types/database';
import { insertGeneration } from '@/lib/db';

const OUTPUTS_DIR = path.join(process.cwd(), 'public', 'outputs');
const HISTORY_FILE = path.join(OUTPUTS_DIR, 'history.json');
const BACKUP_FILE = path.join(OUTPUTS_DIR, 'history.bak.json');
const OLD_FILE = path.join(OUTPUTS_DIR, 'history.old.json');

// Unified history item uses Generation DTO

// Helper to ensure outputs directory exists
function isUseLocalStorage() {
    return process.env.USE_LOCAL_STORAGE === 'true';
}

async function ensureOutputsDir() {
    try {
        await fs.access(OUTPUTS_DIR);
    } catch {
        await fs.mkdir(OUTPUTS_DIR, { recursive: true });
    }
}

// Robust helper to read history from multiple possible sources
async function readHistory() {
    const filesToTry = [HISTORY_FILE, OLD_FILE, BACKUP_FILE];

    for (const file of filesToTry) {
        try {
            await fs.access(file);
            const content = await fs.readFile(file, 'utf-8');
            const data = JSON.parse(content);
            if (Array.isArray(data)) return data;
        } catch {
            // console.warn(`Failed to read history from ${path.basename(file)}`);
        }
    }
    return null;
}

// Atomic write helper with backup
async function saveHistory(history: Generation[]) {
    const tmpFile = `${HISTORY_FILE}.tmp`;
    
    // 1. Sanitize history to prevent RangeError: Invalid string length
    // Keep only the last 1000 items in the global index to keep it manageable
    const MAX_HISTORY_ITEMS = 1000;
    const itemsToSave = history.slice(0, MAX_HISTORY_ITEMS);

    const sanitizedHistory = itemsToSave.map(item => {
        const newItem = { ...item };
        
        // Remove extremely large fields in the global history index
        if (newItem.sourceImageUrl && newItem.sourceImageUrl.length > 5000) {
            if (newItem.sourceImageUrl.startsWith('data:')) {
                newItem.sourceImageUrl = "(large base64 data truncated)";
            }
        }

        // Deep sanitize config if needed
        if (newItem.config) {
            const config = newItem.config as any;
            if (config.sourceImageUrl && config.sourceImageUrl.length > 5000) {
                if (config.sourceImageUrl.startsWith('data:')) {
                    config.sourceImageUrl = "(large base64 data truncated)";
                }
            }
        }

        return newItem;
    });

    // 2. Use compact JSON for the global index if it's still large
    // Indentation (null, 2) can triple the size of the file
    const content = JSON.stringify(sanitizedHistory);

    try {
        // 1. 先写入临时文件
        await fs.writeFile(tmpFile, content, 'utf-8');

        // 2. 如果原文件存在，将其备份为 old
        try {
            await fs.access(HISTORY_FILE);
            await fs.copyFile(HISTORY_FILE, OLD_FILE);
        } catch { /* ignore if not exists */ }

        // 3. 将 tmp 重命名为正式文件 (原子操作)
        await fs.rename(tmpFile, HISTORY_FILE);

        // 4. 定期备份 (如果记录数是 50 的倍数，或者 bak 不存在)
        if (history.length % 50 === 0) {
            await fs.copyFile(HISTORY_FILE, BACKUP_FILE);
        } else {
            try {
                await fs.access(BACKUP_FILE);
            } catch {
                await fs.copyFile(HISTORY_FILE, BACKUP_FILE);
            }
        }

        return true;
    } catch (e) {
        console.error("Atomic save failed:", e);
        // 清理临时文件
        try { await fs.unlink(tmpFile); } catch { }
        return false;
    }
}


// NEW: Read history entries directly from the outputs directory
async function readHistoryFromDisk() {
    await ensureOutputsDir();

    // 1. Get all image files on disk
    const files = await fs.readdir(OUTPUTS_DIR);
    const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

    // Process image files
    const items = await Promise.all(
        files
            .filter(f => imageExtensions.has(path.extname(f).toLowerCase()))
            .map(async (filename) => {
                const baseName = filename.split('.')[0];
                const jsonPath = path.join(OUTPUTS_DIR, `${baseName}.json`);
                const outputUrl = `/outputs/${filename}`;

                let metadata = null;
                try {
                    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
                    metadata = JSON.parse(jsonContent);
                } catch { /* No metadata or folder exists */ }

                // Determine timestamp: priority 1: json metadata, priority 2: filename stamp, priority 3: file stat
                let createdAt = metadata?.timestamp;
                if (!createdAt) {
                    const parts = baseName.split('_');
                    const stampStr = parts[1]; // img_STAMP_RAND
                    if (stampStr && !isNaN(Number(stampStr))) {
                        createdAt = new Date(Number(stampStr)).toISOString();
                    } else {
                        const stats = await fs.stat(path.join(OUTPUTS_DIR, filename));
                        createdAt = stats.mtime.toISOString();
                    }
                }

                const config: GenerationConfig = (() => {
                    if (metadata?.config && typeof metadata.config === 'object') {
                        return {
                            prompt: metadata.config.prompt || '',
                            width: Number(metadata.config.width || 1024),
                            height: Number(metadata.config.height || 1024),
                            model: metadata.config.model || '',
                            loras: metadata.config.loras || [],
                            presetName: metadata.config.presetName || '',
                        };
                    }
                    return {
                        prompt: metadata?.prompt || metadata?.metadata?.prompt || '',
                        width: Number(metadata?.img_width || metadata?.metadata?.img_width || 1024),
                        height: Number(metadata?.img_height || metadata?.metadata?.img_height || 1024),
                        model: metadata?.base_model || metadata?.metadata?.base_model || '',
                        loras: metadata?.loras || metadata?.metadata?.loras || [],
                        presetName: metadata?.presetName || metadata?.metadata?.presetName || '',
                    };
                })();

                const gen: Generation = {
                    id: baseName,
                    userId: 'anonymous',
                    projectId: metadata?.projectId || metadata?.metadata?.projectId || 'default',
                    outputUrl,
                    config,
                    status: 'completed',
                    sourceImageUrl: metadata?.sourceImageUrl || metadata?.sourceImage || metadata?.metadata?.sourceImage,
                    createdAt: String(metadata?.createdAt || createdAt),
                };
                return gen;
            })
    );

    // Filter out potential nulls if any (though not expected here)
    const validItems = items.filter(Boolean);

    // Sort by timestamp descending
    validItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return validItems;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const projectId = searchParams.get('projectId');
        const userId = searchParams.get('userId');

        // 1. 优先读取统一的历史记录文件 (快)
        let history = await readHistory();
        
        // 2. 如果没有历史记录文件，或者有新文件未被索引，则执行同步
        // 快速检查磁盘上的图片文件，看是否都在 history 中
        let hasChanges = false;
        if (!history || history.length === 0) {
            history = await readHistoryFromDisk();
            hasChanges = true;
        } else {
            // 增量同步：检查是否有文件不在 history 中
            try {
                await ensureOutputsDir();
                const files = await fs.readdir(OUTPUTS_DIR);
                const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
                
                // 构建现有历史记录的快速查找集合
                const existingFiles = new Set(history.map((h: Generation) => {
                    const url = h.outputUrl || '';
                    return path.basename(url);
                }));

                const newFiles = files.filter(f => {
                    const ext = path.extname(f).toLowerCase();
                    return imageExtensions.has(ext) && !existingFiles.has(f);
                });

                if (newFiles.length > 0) {
                    // 只处理新发现的文件
                    const newItems = await Promise.all(
                        newFiles.map(async (filename) => {
                            const baseName = filename.split('.')[0];
                            const jsonPath = path.join(OUTPUTS_DIR, `${baseName}.json`);
                            const outputUrl = `/outputs/${filename}`;

                            let metadata = null;
                            try {
                                const jsonContent = await fs.readFile(jsonPath, 'utf-8');
                                metadata = JSON.parse(jsonContent);
                            } catch { /* No metadata */ }

                            let createdAt = metadata?.timestamp;
                            if (!createdAt) {
                                const parts = baseName.split('_');
                                const stampStr = parts[1];
                                if (stampStr && !isNaN(Number(stampStr))) {
                                    createdAt = new Date(Number(stampStr)).toISOString();
                                } else {
                                    const stats = await fs.stat(path.join(OUTPUTS_DIR, filename));
                                    createdAt = stats.mtime.toISOString();
                                }
                            }

                            const config: GenerationConfig = (() => {
                                if (metadata?.config && typeof metadata.config === 'object') {
                                    return {
                                        prompt: metadata.config.prompt || '',
                                        width: Number(metadata.config.width || 1024),
                                        height: Number(metadata.config.height || 1024),
                                        model: metadata.config.model || '',
                                        loras: metadata.config.loras || [],
                                        presetName: metadata.config.presetName || '',
                                    };
                                }
                                return {
                                    prompt: metadata?.prompt || metadata?.metadata?.prompt || '',
                                    width: Number(metadata?.img_width || metadata?.metadata?.img_width || 1024),
                                    height: Number(metadata?.img_height || metadata?.metadata?.img_height || 1024),
                                    model: metadata?.base_model || metadata?.metadata?.base_model || '',
                                    loras: metadata?.loras || metadata?.metadata?.loras || [],
                                    presetName: metadata?.presetName || metadata?.metadata?.presetName || '',
                                };
                            })();

                            const gen: Generation = {
                                id: baseName,
                                userId: 'anonymous',
                                projectId: metadata?.projectId || metadata?.metadata?.projectId || 'default',
                                outputUrl,
                                config,
                                status: 'completed',
                                sourceImageUrl: metadata?.sourceImageUrl || metadata?.sourceImage || metadata?.metadata?.sourceImage,
                                createdAt: String(metadata?.createdAt || createdAt),
                            };
                            return gen;
                        })
                    );

                    // 合并新数据
                    history = [...newItems, ...history];
                    // 重新按时间排序
                    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    hasChanges = true;
                }
            } catch (e) {
                console.error("Incremental sync failed:", e);
            }
        }

        if (hasChanges && history && history.length > 0) {
            await saveHistory(history);
        }

        // 3. 按项目过滤
        if (projectId && projectId !== 'null' && projectId !== 'undefined') {
            history = history.filter(h => h.projectId === projectId);
        }

        // 4. 按用户过滤
        if (userId) {
            history = history.filter(h => h.userId === userId || (!h.userId && userId === 'user-1') || (h.userId === 'anonymous' && userId === 'user-1'));
        }

        // 5. 分页处理
        const total = history.length;
        const startIndex = (page - 1) * limit;
        const paginatedHistory = history.slice(startIndex, startIndex + limit);

        return NextResponse.json({ 
            history: paginatedHistory,
            total,
            hasMore: startIndex + limit < total
        });
    } catch (error) {
        console.error('Failed to load history:', error);
        return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 云端写入路径：写入 Supabase，而非本地文件
        if (!isUseLocalStorage()) {
            // Handle batch update in cloud mode
            if (body.action === 'batch-update' && Array.isArray(body.items)) {
                const items = body.items as Generation[];

                for (const raw of items) {
                    const item: Generation = { ...raw };

                    // Sanitize incoming item to prevent bloat
                    if (item.sourceImageUrl && item.sourceImageUrl.length > 5000 && item.sourceImageUrl.startsWith('data:')) {
                        item.sourceImageUrl = "(large base64 data truncated)";
                    }
                    if (item.config) {
                        const config = item.config as any;
                        if (config.sourceImageUrl && config.sourceImageUrl.length > 5000 && config.sourceImageUrl.startsWith('data:')) {
                            config.sourceImageUrl = "(large base64 data truncated)";
                        }
                    }

                    const outputUrl = item.outputUrl || (item.id ? `/outputs/${item.id}.png` : '');
                    const record: Generation = {
                        id: item.id || path.basename(outputUrl, path.extname(outputUrl)),
                        userId: item.userId || 'anonymous',
                        projectId: item.projectId || 'default',
                        outputUrl,
                        config: item.config,
                        status: item.status || 'completed',
                        sourceImageUrl: item.sourceImageUrl,
                        createdAt: item.createdAt || new Date().toISOString(),
                    };

                    await insertGeneration(record);
                }

                return NextResponse.json({ success: true });
            }

            const item = body as Generation;
            if (!item || (!item.outputUrl && !item.id)) {
                return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
            }

            // Sanitize incoming item to prevent bloat
            if (item.sourceImageUrl && item.sourceImageUrl.length > 5000 && item.sourceImageUrl.startsWith('data:')) {
                item.sourceImageUrl = "(large base64 data truncated)";
            }
            if (item.config) {
                const config = item.config as any;
                if (config.sourceImageUrl && config.sourceImageUrl.length > 5000 && config.sourceImageUrl.startsWith('data:')) {
                    config.sourceImageUrl = "(large base64 data truncated)";
                }
            }

            const outputUrl = item.outputUrl || (item.id ? `/outputs/${item.id}.png` : '');
            const record: Generation = {
                id: item.id || path.basename(outputUrl, path.extname(outputUrl)),
                userId: item.userId || 'anonymous',
                projectId: item.projectId || 'default',
                outputUrl,
                config: item.config,
                status: item.status || 'completed',
                sourceImageUrl: item.sourceImageUrl,
                createdAt: item.createdAt || new Date().toISOString(),
            };

            await insertGeneration(record);

            return NextResponse.json({ success: true });
        }

        // 本地写入路径：保持原有逻辑，作为兼容回退
        
        // Handle batch update
        if (body.action === 'batch-update' && Array.isArray(body.items)) {
            const items = body.items as Generation[];
            await ensureOutputsDir();
            
            // 1. Update individual metadata files
            for (const item of items) {
                if (!item.outputUrl) continue;
                const baseName = path.basename(item.outputUrl, path.extname(item.outputUrl));
                const jsonPath = path.join(OUTPUTS_DIR, `${baseName}.json`);
                
                try {
                    let metadata = {};
                    try {
                        const content = await fs.readFile(jsonPath, 'utf-8');
                        metadata = JSON.parse(content);
                    } catch { /* ignore */ }
                    
                    const updatedMetadata = {
                        ...metadata,
                        projectId: item.projectId,
                        config: item.config,
                    };
                    
                    await fs.writeFile(jsonPath, JSON.stringify(updatedMetadata, null, 2));
                } catch (e) {
                    console.warn(`Failed to update metadata for ${baseName}`, e);
                }
            }
            
            // 2. Update global history.json
            const history = (await readHistory() || []) as Generation[];
            for (const item of items) {
                const idx = history.findIndex(h => h.id === item.id || h.outputUrl === item.outputUrl);
                if (idx > -1) {
                    history[idx] = { ...history[idx], ...item };
                }
            }
            await saveHistory(history);
            
            return NextResponse.json({ success: true });
        }

        const item = body as Generation;
        if (!item || (!item.outputUrl && !item.id)) {
            return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
        }

        // Sanitize incoming item to prevent bloat
        if (item.sourceImageUrl && item.sourceImageUrl.length > 5000 && item.sourceImageUrl.startsWith('data:')) {
            item.sourceImageUrl = "(large base64 data truncated)";
        }
        if (item.config) {
            const config = item.config as any;
            if (config.sourceImageUrl && config.sourceImageUrl.length > 5000 && config.sourceImageUrl.startsWith('data:')) {
                config.sourceImageUrl = "(large base64 data truncated)";
            }
        }

        await ensureOutputsDir();
        const history = (await readHistory() || []) as Generation[];
        const outputUrl = item.outputUrl || (item.id ? `/outputs/${item.id}.png` : '');
        const record: Generation = {
            id: item.id || path.basename(outputUrl, path.extname(outputUrl)),
            userId: item.userId || 'anonymous',
            projectId: item.projectId || 'default',
            outputUrl,
            config: item.config,
            status: item.status || 'completed',
            sourceImageUrl: item.sourceImageUrl,
            createdAt: item.createdAt || new Date().toISOString(),
        };

        const existsIndex = history.findIndex((h: Generation) => h.outputUrl === record.outputUrl || h.id === record.id);
        if (existsIndex > -1) {
            history[existsIndex] = record;
        } else {
            history.unshift(record);
        }

        const success = await saveHistory(history);
        if (!success) {
            throw new Error("Failed to perform atomic save");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save history item:', error);
        return NextResponse.json({ error: 'Failed to save history item' }, { status: 500 });
    }
}
