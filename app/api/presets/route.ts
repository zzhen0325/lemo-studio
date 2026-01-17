import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/server/db/mongo';
import { PresetModel } from '@/server/db/models';
import { v4 as uuidv4 } from 'uuid';

// GET: List all presets
export async function GET() {
    try {
        await connectMongo();
        const presets = await PresetModel.find().sort({ createdAt: -1 }).lean();
        
        // Map _id to id for frontend compatibility
        const formattedPresets = presets.map(p => ({
            ...p,
            id: String(p._id),
            _id: undefined
        }));
        
        return NextResponse.json(formattedPresets);
    } catch (error) {
        console.error('Failed to fetch presets from MongoDB', error);
        return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 });
    }
}

// POST: Create or Update a preset
export async function POST(req: NextRequest) {
    try {
        await connectMongo();
        const formData = await req.formData();
        const jsonStr = formData.get('json') as string;
        const coverFile = formData.get('cover') as File | null;

        if (!jsonStr) {
            return NextResponse.json({ error: 'Missing json data' }, { status: 400 });
        }

        const presetData = JSON.parse(jsonStr);
        if (!presetData.id) {
            presetData.id = uuidv4();
        }
        const id = presetData.id;

        // Handle Cover Image
        if (coverFile && coverFile.size > 0) {
            const arrayBuffer = await coverFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const dataUrl = `data:${coverFile.type || 'image/png'};base64,${base64}`;
            presetData.coverUrl = dataUrl;
        }

        await PresetModel.findOneAndUpdate(
            { _id: id },
            {
                _id: id,
                name: presetData.name,
                coverUrl: presetData.coverUrl,
                coverData: presetData.coverUrl?.startsWith('data:') ? presetData.coverUrl : undefined,
                config: presetData.config,
                editConfig: presetData.editConfig,
                category: presetData.category,
                projectId: presetData.projectId,
                type: presetData.type,
                createdAt: presetData.createdAt || new Date().toISOString(),
            },
            { upsert: true, new: true }
        );

        return NextResponse.json(presetData);

    } catch (error) {
        console.error('Save preset error:', error);
        return NextResponse.json({ error: 'Failed to save preset' }, { status: 500 });
    }
}

// DELETE: Remove a preset
export async function DELETE(req: NextRequest) {
    try {
        await connectMongo();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await PresetModel.deleteOne({ _id: id });
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete preset error:', error);
        return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 });
    }
}
