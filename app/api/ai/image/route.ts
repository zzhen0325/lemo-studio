import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/modelRegistry";
import { ImageGenerationInput, ImageProvider } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            prompt,
            model,
            width,
            height,
            batchSize,
            aspectRatio,
            image, // for i2i
            options
        } = body;

        if (!model) {
            return NextResponse.json({ error: "Missing model ID" }, { status: 400 });
        }

        const providerInstance = getProvider(model);

        if (!('generateImage' in providerInstance)) {
            return NextResponse.json({ error: `Model ${model} does not support image generation` }, { status: 400 });
        }

        const params: ImageGenerationInput = {
            prompt,
            width,
            height,
            batchSize,
            aspectRatio,
            image,
            options
        };

        const result = await (providerInstance as unknown as ImageProvider).generateImage(params);

        return NextResponse.json(result);

    } catch (error: unknown) {
        console.error("Unified Image API Error:", error);
        const msg = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        );
    }
}
