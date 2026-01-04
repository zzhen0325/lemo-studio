import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const OUTPUTS_DIR = path.join(process.cwd(), 'public', 'outputs');
const HISTORY_FILE = path.join(OUTPUTS_DIR, 'history.json');
const BACKUP_FILE = path.join(OUTPUTS_DIR, 'history.bak.json');
const OLD_FILE = path.join(OUTPUTS_DIR, 'history.old.json');

export interface HistoryItem {
    imageUrl: string;
    timestamp: string;
    metadata: {
        prompt?: string;
        base_model?: string;
        img_width?: number;
        img_height?: number;
        lora?: string;
    };
    type?: 'image' | 'text';
    sourceImage?: string;
    projectId?: string;
}

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
async function saveHistory(history: HistoryItem[]) {
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
                const imageUrl = `/outputs/${filename}`;

                let metadata = null;
                try {
                    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
                    metadata = JSON.parse(jsonContent);
                } catch { /* No metadata or folder exists */ }

                // Determine timestamp: priority 1: json metadata, priority 2: filename stamp, priority 3: file stat
                let timestamp = metadata?.timestamp;
                if (!timestamp) {
                    const parts = baseName.split('_');
                    const stampStr = parts[1]; // img_STAMP_RAND
                    if (stampStr && !isNaN(Number(stampStr))) {
                        timestamp = new Date(Number(stampStr)).toISOString();
                    } else {
                        const stats = await fs.stat(path.join(OUTPUTS_DIR, filename));
                        timestamp = stats.mtime.toISOString();
                    }
                }

                return {
                    timestamp,
                    imageUrl,
                    metadata: {
                        prompt: metadata?.prompt || metadata?.metadata?.prompt || '',
                        base_model: metadata?.base_model || metadata?.metadata?.base_model || '',
                        img_width: metadata?.img_width || metadata?.metadata?.img_width || 1024,
                        img_height: metadata?.img_height || metadata?.metadata?.img_height || 1024,
                        lora: metadata?.lora || metadata?.metadata?.lora || ''
                    },
                    type: metadata?.type || metadata?.metadata?.type || 'image',
                    sourceImage: metadata?.sourceImage || metadata?.metadata?.sourceImage,
                    projectId: metadata?.projectId || metadata?.metadata?.projectId || 'default'
                } as HistoryItem;
            })
    );

    // Filter out potential nulls if any (though not expected here)
    const validItems = items.filter(Boolean);

    // Sort by timestamp descending
    validItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
        const item = await request.json();

        if (!item || (!item.imageUrl && !item.id)) {
            return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
        }

        await ensureOutputsDir();
        const history = (await readHistory() || []) as HistoryItem[];

        const imageUrl = item.imageUrl || (item.id ? `/outputs/${item.id}.png` : '');

        const historyItem: HistoryItem = {
            timestamp: item.timestamp || new Date().toISOString(),
            imageUrl: imageUrl,
            metadata: {
                prompt: item.metadata?.prompt || item.prompt || item.config?.prompt || '',
                base_model: item.metadata?.base_model || item.config?.base_model || '',
                img_width: item.metadata?.img_width || item.config?.img_width || 1024,
                img_height: item.metadata?.img_height || item.config?.image_height || 1024,
                lora: item.metadata?.lora || item.config?.lora || ''
            },
            type: item.type || 'image',
            sourceImage: item.sourceImage,
            projectId: item.projectId || 'default'
        };

        const existsIndex = history.findIndex((h: HistoryItem) => h.imageUrl === historyItem.imageUrl);
        if (existsIndex > -1) {
            history[existsIndex] = historyItem;
        } else {
            history.unshift(historyItem);
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
