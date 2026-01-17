import { NextRequest, NextResponse } from 'next/server';
import { connectMongo } from '@/server/db/mongo';
import { PresetCategoryModel } from '@/server/db/models';

const DEFAULT_CATEGORIES = ['General', 'Portrait', 'Landscape', 'Anime', '3D', 'Architecture', 'Character', 'Workflow', 'Other'];

export async function GET() {
    try {
        await connectMongo();
        const doc = await PresetCategoryModel.findOne({ key: 'default' }).lean();
        if (doc && doc.categories && doc.categories.length > 0) {
            return NextResponse.json(doc.categories);
        }
        return NextResponse.json(DEFAULT_CATEGORIES);
    } catch (error) {
        console.error('Failed to get categories from MongoDB', error);
        return NextResponse.json(DEFAULT_CATEGORIES);
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectMongo();
        const categories = await req.json();
        await PresetCategoryModel.updateOne(
            { key: 'default' },
            { categories },
            { upsert: true }
        );
        return NextResponse.json(categories);
    } catch (error) {
        console.error('Failed to save categories to MongoDB', error);
        return NextResponse.json({ error: 'Failed to save categories' }, { status: 500 });
    }
}
