import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { StyleStack } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const STYLE_DIR = path.join(process.cwd(), 'public/styles');

async function ensureStyleDir() {
    try {
        await fs.access(STYLE_DIR);
    } catch {
        await fs.mkdir(STYLE_DIR, { recursive: true });
    }
}

// GET: List all style stacks
export async function GET() {
    await ensureStyleDir();
    try {
        const files = await fs.readdir(STYLE_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        const styles: StyleStack[] = [];
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(STYLE_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const style = JSON.parse(content);
                styles.push(style);
            } catch (e) {
                console.error(`Failed to parse style ${file}`, e);
            }
        }

        // Sort by updatedAt descending
        styles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return NextResponse.json(styles);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch styles' }, { status: 500 });
    }
}

// POST: Create or Update a style stack
export async function POST(req: NextRequest) {
    await ensureStyleDir();
    try {
        const styleData = await req.json() as StyleStack;

        if (!styleData.id) {
            styleData.id = uuidv4();
        }

        styleData.updatedAt = new Date().toISOString();

        // Save JSON
        const jsonPath = path.join(STYLE_DIR, `${styleData.id}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(styleData, null, 2));

        return NextResponse.json(styleData);

    } catch (error) {
        console.error('Save style error:', error);
        return NextResponse.json({ error: 'Failed to save style' }, { status: 500 });
    }
}

// DELETE: Remove a style stack
export async function DELETE(req: NextRequest) {
    await ensureStyleDir();
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const jsonPath = path.join(STYLE_DIR, `${id}.json`);
        await fs.unlink(jsonPath);

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete style' }, { status: 500 });
    }
}
