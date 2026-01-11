import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CATEGORIES_PATH = path.join(process.cwd(), 'public/preset/categories.json');
const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];

async function ensureDir() {
    const dir = path.dirname(CATEGORIES_PATH);
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

export async function GET() {
    await ensureDir();
    try {
        const content = await fs.readFile(CATEGORIES_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(content));
    } catch {
        return NextResponse.json(DEFAULT_CATEGORIES);
    }
}

export async function POST(req: NextRequest) {
    await ensureDir();
    try {
        const categories = await req.json();
        await fs.writeFile(CATEGORIES_PATH, JSON.stringify(categories, null, 2));
        return NextResponse.json(categories);
    } catch {
        return NextResponse.json({ error: 'Failed to save categories' }, { status: 500 });
    }
}
