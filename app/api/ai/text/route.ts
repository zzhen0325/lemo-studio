import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/modelRegistry";
import { getSystemPrompt } from "@/config/system-prompts";
import { TextProvider, TextGenerationInput } from "@/lib/ai/types";
import { TextRequestSchema } from "@/lib/schemas/ai";

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();
        const parsed = TextRequestSchema.safeParse(json);
        if (!parsed.success) {
            console.log('[API] /api/ai/text invalid payload', parsed.error.flatten());
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const {
            input,
            model,
            profileId,
            systemPrompt: explicitSystemPrompt,
            options
        } = parsed.data;

        // 1. Get Provider instance
        const providerInstance = getProvider(model);

        // 2. Resolve System Prompt
        // Priority: Explicit > Profile > Default (empty)
        let resolvedSystemPrompt = explicitSystemPrompt;

        if (!resolvedSystemPrompt && profileId) {
            // Re-deriving providerId for prompt resolution logic
            let providerIdForPrompt = 'unknown';
            if (model.includes('doubao')) providerIdForPrompt = 'doubao';
            else if (model.includes('deepseek')) providerIdForPrompt = 'deepseek';
            else if (model.includes('gemini')) providerIdForPrompt = 'google';
            else if (model.includes('google')) providerIdForPrompt = 'google';

            resolvedSystemPrompt = getSystemPrompt(profileId, providerIdForPrompt);
        }

        const params: TextGenerationInput = {
            input,
            systemPrompt: resolvedSystemPrompt,
            options
        };

        if (!('generateText' in providerInstance)) {
            return NextResponse.json({ error: `Model ${model} does not support text generation` }, { status: 400 });
        }

        const result = await (providerInstance as TextProvider).generateText(params);

        // 4. Return
        if (result.stream) {
            // TODO: Stream support
            return new NextResponse(result.stream, {
                headers: { 'Content-Type': 'text/event-stream' }
            });
        } else {
            return NextResponse.json({ text: result.text });
        }

    } catch (error: unknown) {
        console.error("Unified Text API Error:", error);
        const msg = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        );
    }
}
