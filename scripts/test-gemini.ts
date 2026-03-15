
// @ts-ignore
import fs from 'fs';
// @ts-ignore
import path from 'path';

async function testGemini() {
    let apiKey = '';
    try {
        const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
        const match = envContent.match(/GOOGLE_GENAI_API_KEY=(.*)/);
        if (match) {
            apiKey = match[1].trim();
        }
    } catch (e) {
        console.error("Could not read .env.local");
    }

    const modelId = 'gemini-2.5-flash-image';
    const baseURL = "https://generativelanguage.googleapis.com/v1beta";

    console.log(`Testing model: ${modelId}`);
    console.log(`API Key present: ${!!apiKey}`);

    if (!apiKey) {
        console.error("Error: GOOGLE_GENAI_API_KEY not found in .env.local");
        return;
    }

    const url = `${baseURL}/models/${modelId}:generateContent?key=${apiKey}`;
    const prompt = "A cute yellow cartoon character named Lemo, simple style, 2d illustration";

    const body = {
        contents: [{
            role: "user",
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
                aspectRatio: "16:9"
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} - ${errorText}`);
            return;
        }

        const data = await response.json() as any;
        console.log("Response received successfully!");
        
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts;

        if (parts && parts.length > 0) {
            for (const part of parts) {
                const inlineData = part.inline_data || part.inlineData;
                if (inlineData && inlineData.data) {
                    console.log(`Image generated! Mime type: ${inlineData.mime_type || inlineData.mimeType}`);
                    console.log(`Base64 data length: ${inlineData.data.length}`);
                    return;
                }
            }
            console.log("No image data found in response parts.");
            console.log("Full response:", JSON.stringify(data, null, 2));
        } else {
            console.log("No candidates or parts returned.");
            console.log("Full response:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testGemini();
