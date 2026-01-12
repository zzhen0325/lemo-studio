export interface ModelConfig {
    providerId: string;
    modelId: string;
    apiKey?: string;
    baseURL?: string; // For OpenAI compatible providers
}

export interface ProviderOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
}

export interface TextGenerationInput {
    input: string; // User message or prompt
    systemPrompt?: string;
    options?: ProviderOptions;
}

export interface VisionGenerationInput {
    image: string; // Base64 string or URL
    prompt?: string; // Optional prompt for the image
    systemPrompt?: string;
    options?: ProviderOptions;
}

export interface ImageGenerationInput {
    prompt: string;
    negativePrompt?: string;
    image?: string; // For i2i
    images?: string[]; // Multiple images support (original + refs)
    aspectRatio?: string;
    imageSize?: string;
    width?: number;
    height?: number;
    batchSize?: number;
    options?: ProviderOptions & {
        seed?: number;
        steps?: number;
        cfgScale?: number;
        sampler?: string;
        scheduler?: string;
    };
}

export interface ImageResult {
    images: string[]; // List of base64 or URLs
    metadata?: Record<string, unknown>;
    stream?: ReadableStream<Uint8Array>; // For image generation with text progress or logs
}

export interface TextResult {
    text: string;
    stream?: ReadableStream<Uint8Array>; // Standardized stream
}

export interface TextProvider {
    generateText(params: TextGenerationInput): Promise<TextResult>;
}

export interface VisionProvider {
    describeImage(params: VisionGenerationInput): Promise<TextResult>;
}

export interface ImageProvider {
    generateImage(params: ImageGenerationInput): Promise<ImageResult>;
}

export interface AIProvider extends TextProvider, VisionProvider, ImageProvider {
    // Some providers might support multiple
}
