import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Generation, GenerationConfig } from '@/types/database';

const OUTPUTS_DIR = path.join(process.cwd(), 'public', 'outputs');
const HISTORY_FILE = path.join(OUTPUTS_DIR, 'history.json');
const BACKUP_FILE = path.join(OUTPUTS_DIR, 'history.bak.json');
const OLD_FILE = path.join(OUTPUTS_DIR, 'history.old.json');

// Unified history item uses Generation DTO

// Helper to ensure outputs directory exists
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
    const content = JSON.stringify(history, null, 2);

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

export async function GET() {
    try {
        const history = await readHistoryFromDisk();
        return NextResponse.json({ history });
    } catch (error) {
        console.error('Failed to load history:', error);
        return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const item = await request.json() as Generation;
        if (!item || (!item.outputUrl && !item.id)) {
            return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
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
