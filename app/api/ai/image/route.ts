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

        console.log(`[API] /api/ai/image request body options:`, JSON.stringify(body.options));
        
        const params: ImageGenerationInput = {
            prompt: prompt ?? '',
            width,
            height,
            batchSize,
            aspectRatio,
            image,
            options: {
                 ...options,
                 // Ensure stream is true for coze-image models if we are expecting a stream
                 stream: options?.stream === true || model === 'coze_seed4'
             }
        };

        console.log(`[API] /api/ai/image params.options.stream:`, params.options?.stream);
        const result = await (providerInstance as unknown as ImageProvider).generateImage(params);

        if (result.stream) {
            console.log(`[API] /api/ai/image returning SSE stream for model: ${model}`);
            return new Response(result.stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        console.log(`[API] /api/ai/image returning JSON response for model: ${model}. result.stream is ${typeof result.stream}`);
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
