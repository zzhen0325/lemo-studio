import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/modelRegistry";
import { getSystemPrompt } from "@/config/system-prompts";
import { VisionGenerationInput } from "@/lib/ai/types";
import { DescribeRequestSchema } from "@/lib/schemas/ai";

export async function POST(req: NextRequest) {
    try {
        const json = await req.json();
        const parsed = DescribeRequestSchema.safeParse(json);
        if (!parsed.success) {
            console.log('[API] /api/ai/describe invalid payload', parsed.error.flatten());
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const {
            image, // Base64 or URL
            model,
            profileId,
            systemPrompt: explicitSystemPrompt,
            prompt, // User prompt for the image
            options
        } = parsed.data;

        const providerInstance = getProvider(model);

        // Ensure provider supports vision - naive check via typing or just try/catch
        if (!('describeImage' in providerInstance)) {
            return NextResponse.json({ error: `Model ${model} does not support vision tasks` }, { status: 400 });
        }

        // Resolve System Prompt
        let resolvedSystemPrompt = explicitSystemPrompt;
        if (!resolvedSystemPrompt && profileId) {
            let providerIdForPrompt = 'unknown';
            // Simple heuristic again
            if (model.includes('gemini') || model.includes('google')) providerIdForPrompt = 'google';
            else if (model.includes('doubao')) providerIdForPrompt = 'doubao'; // Doubao vision support?
            else if (model.includes('deepseek')) providerIdForPrompt = 'deepseek';

            resolvedSystemPrompt = getSystemPrompt(profileId, providerIdForPrompt);
        }

        const params: VisionGenerationInput = {
            image,
            prompt,
            systemPrompt: resolvedSystemPrompt,
            options
        };

        const result = await providerInstance.describeImage(params);
        const text = result.text?.trim() || '';

        if (!text) {
            const hasSystemPrompt = Boolean(resolvedSystemPrompt && resolvedSystemPrompt.trim());
            return NextResponse.json(
                {
                    error: `Model returned empty text (hasSystemPrompt=${hasSystemPrompt})`,
                    model,
                    hasSystemPrompt,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({ text });

    } catch (error: unknown) {
        console.error("Unified Describe API Error:", error);
        const msg = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        );
    }
}
