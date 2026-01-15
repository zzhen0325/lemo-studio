import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Preset } from '@/components/features/playground-v2/types';
import { queryPresets } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Helper to ensure directory exists
const PRESET_DIR = path.join(process.cwd(), 'public/preset');

function isUseLocalStorage() {
    return process.env.USE_LOCAL_STORAGE === 'true';
}

async function ensurePresetDir() {
    try {
        await fs.access(PRESET_DIR);
    } catch {
        await fs.mkdir(PRESET_DIR, { recursive: true });
    }
}

// GET: List all presets
export async function GET() {
    // 云端读取路径：优先从 Supabase presets 表读取
    if (!isUseLocalStorage()) {
        try {
            const presets = await queryPresets();
            return NextResponse.json(presets);
        } catch (error) {
            console.error('Failed to fetch presets from database, fallback to local files:', error);
            // fall through to local branch
        }
    }

    // 本地读取路径：保持原有逻辑，作为兼容回退
    await ensurePresetDir();
    try {
        const files = await fs.readdir(PRESET_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        const presets: Preset[] = [];
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(PRESET_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const preset = JSON.parse(content);
                presets.push(preset);
            } catch (e) {
                console.error(`Failed to parse preset ${file}`, e);
            }
        }

        // Sort by title or creation time if available (currently just random order)
        return NextResponse.json(presets);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
    }
}

// POST: Create or Update a preset
export async function POST(req: NextRequest) {
    await ensurePresetDir();
    try {
        const formData = await req.formData();
        const jsonStr = formData.get('json') as string;
        const coverFile = formData.get('cover') as File | null;

        if (!jsonStr) {
            return NextResponse.json({ error: 'Missing json data' }, { status: 400 });
        }

        const presetData = JSON.parse(jsonStr) as Preset;
        // If no ID, generate one. But usually frontend might send one? 
        // Let's ensure there is an ID.
        if (!presetData.id) {
            presetData.id = uuidv4();
        }
        const id = presetData.id;

        // Handle Cover Image
        if (coverFile && coverFile.size > 0) {
            const arrayBuffer = await coverFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Determine extension
            let ext = 'png';
            if (coverFile.type === 'image/jpeg') ext = 'jpg';
            else if (coverFile.type === 'image/webp') ext = 'webp';

            const fileName = `${id}.${ext}`;
            const filePath = path.join(PRESET_DIR, fileName);

            await fs.writeFile(filePath, buffer);
            presetData.coverUrl = `/preset/${fileName}`;
        }

        // Save JSON
        const jsonPath = path.join(PRESET_DIR, `${id}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(presetData, null, 2));

        return NextResponse.json(presetData);

    } catch (error) {
        console.error('Save preset error:', error);
        return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 });
    }
}

// DELETE: Remove a preset
export async function DELETE(req: NextRequest) {
    await ensurePresetDir();
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const jsonPath = path.join(PRESET_DIR, `${id}.json`);

        // Try to find the image to delete too
        // We strictly assume the image is named [id].[ext] but we don't know the ext.
        // Or we read the JSON first to find the cover path.

        // Strategy: Read JSON to get cover path
        try {
            const content = await fs.readFile(jsonPath, 'utf-8');
            const preset = JSON.parse(content);
            if (preset.cover && preset.cover.startsWith('/preset/')) {
                const imageName = path.basename(preset.cover);
                const imagePath = path.join(PRESET_DIR, imageName);
                await fs.unlink(imagePath).catch(() => { }); // Ignore if not found
            }
        } catch {
            // failed to read/parse json, just proceed to delete json
        }

        await fs.unlink(jsonPath);
        return NextResponse.json({ success: true });

    } catch {
        // If error is ENOENT (file not found), consider it success
        return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
    }
}
