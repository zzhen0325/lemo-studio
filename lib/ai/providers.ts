import {
  TextProvider,
  VisionProvider,
  ImageProvider,
  TextGenerationInput,
  VisionGenerationInput,
  ImageGenerationInput,
  TextResult,
  ImageResult,
  ModelConfig,
} from "./types";
import { promises as fs } from "fs";
import path from "path";
import {
  generateNonce,
  generateSign,
  generateTimestamp,
  getProxyAgent,
} from "./utils";

// Ensure we always return ArrayBuffer (not SharedArrayBuffer) for Blob
const bufferToArrayBuffer = (buf: Buffer): ArrayBuffer =>
  Uint8Array.from(buf).buffer;

export class OpenAICompatibleProvider implements TextProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateText(params: TextGenerationInput): Promise<TextResult> {
    const { input, systemPrompt, options } = params;

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: input });

    const body = {
      model: this.config.modelId,
      messages: messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stream: options?.stream || false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    const response = await fetch(
      `${this.config.baseURL}/chat/completions`,
      fetchOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider API Error: ${response.status} - ${errorText}`);
    }

    if (options?.stream) {
      // TODO: Implement standardized stream handling
      // For now fallback to text json
      throw new Error("Stream not fully implemented in adapter yet");
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content || "";

    return { text };
  }
}

/**
 * 豆包视觉模型Provider - 支持文字和图片输入
 * 使用 /api/v3/responses 端点，格式与标准OpenAI不同
 */
export class DoubaoVisionProvider implements TextProvider, VisionProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateText(params: TextGenerationInput): Promise<TextResult> {
    const { input, systemPrompt } = params;

    const content: { type: string; text?: string }[] = [];
    if (systemPrompt) {
      content.push({ type: "input_text", text: systemPrompt });
    }
    content.push({ type: "input_text", text: input });

    const body = {
      model: this.config.modelId,
      input: [{ role: "user", content }],
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    const response = await fetch(
      `${this.config.baseURL}/responses`,
      fetchOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Doubao API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 豆包响应格式: output数组中可能有reasoning和message两种类型
    // 需要找到type为message的output，然后从其content中找到output_text
    const typedData = data as {
      output?: {
        type: string;
        content?: { type: string; text?: string }[];
      }[];
    };

    // 找到message类型的output
    const messageOutput = typedData.output?.find((o) => o.type === "message");
    const text =
      messageOutput?.content?.find((c) => c.type === "output_text")?.text || "";

    return { text };
  }

  async describeImage(params: VisionGenerationInput): Promise<TextResult> {
    const { image, prompt, systemPrompt } = params;

    // 处理图片URL或base64
    let imageUrl = image;
    if (image.startsWith("data:")) {
      // 如果是base64，需要先上传或使用data URL
      // 豆包API直接支持data URL格式
      imageUrl = image;
    }

    const content: { type: string; text?: string; image_url?: string }[] = [];

    // 先添加图片
    content.push({ type: "input_image", image_url: imageUrl });

    // 添加系统提示词和用户提示词
    if (systemPrompt) {
      content.push({ type: "input_text", text: systemPrompt });
    }
    if (prompt) {
      content.push({ type: "input_text", text: prompt });
    } else {
      content.push({ type: "input_text", text: "请描述这张图片" });
    }

    const body = {
      model: this.config.modelId,
      input: [{ role: "user", content }],
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    const response = await fetch(
      `${this.config.baseURL}/responses`,
      fetchOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Doubao Vision API Error: ${response.status} - ${errorText}`
      );
    }

    const data = (await response.json()) as {
      output?: { content?: { type: string; text?: string }[] }[];
    };
    const text =
      data.output?.[0]?.content?.find((c) => c.type === "output_text")?.text ||
      "";

    return { text };
  }
}

export class GoogleGenAIProvider
  implements TextProvider, VisionProvider, ImageProvider
{
  private apiKey: string;
  private modelId: string;
  private baseURL = "https://generativelanguage.googleapis.com/v1beta";

  constructor(config: ModelConfig) {
    console.log(
      `[GoogleGenAIProvider] Initializing with model: ${
        config.modelId
      }, hasApiKey: ${!!config.apiKey}`
    );

    this.apiKey = config.apiKey!;
    this.modelId = config.modelId;
  }

  async generateText(params: TextGenerationInput): Promise<TextResult> {
    const { input, systemPrompt } = params;

    const contents = [];
    if (systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: systemPrompt + "\n\n" + input }],
      });
    } else {
      contents.push({ role: "user", parts: [{ text: input }] });
    }

    const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google GenAI API Error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { text };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Google GenAI Error: ${msg}`);
    }
  }

  async describeImage(params: VisionGenerationInput): Promise<TextResult> {
    const { image, prompt, systemPrompt } = params;

    let base64Data = image;
    let mimeType = "image/png";

    if (image.startsWith("data:")) {
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const parts: {
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }[] = [{ inlineData: { mimeType, data: base64Data } }];

    if (systemPrompt) parts.push({ text: systemPrompt });
    if (prompt) parts.push({ text: prompt });

    const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google GenAI API Error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { text };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Google GenAI Vision Error: ${msg}`);
    }
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, aspectRatio, imageSize, image } = params;
    const parts: {
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }[] = [];

    if (image || (params.images && params.images.length > 0)) {
      const imageList = image ? [image] : params.images || [];
      for (const img of imageList) {
        let base64Data = img;
        if (img.startsWith("data:")) {
          base64Data = img.split(",")[1];
        }
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        });
      }
    }

    parts.push({ text: prompt });

    const configParams: Record<string, unknown> = {
      responseModalities: ["IMAGE"],
    };

    if (aspectRatio || imageSize) {
      configParams.imageConfig = {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(imageSize ? { imageSize } : {}),
      };
    }

    const url = `${this.baseURL}/models/gemini-3-pro-image-preview:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: configParams,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google GenAI API Error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      const resParts = candidate?.content?.parts;

      if (!resParts)
        throw new Error("No image data returned from Google GenAI");

      for (const part of resParts) {
        if (part.inlineData && part.inlineData.data) {
          const dataUrl = `data:${
            part.inlineData.mimeType || "image/png"
          };base64,${part.inlineData.data}`;
          return { images: [dataUrl] };
        }
      }
      throw new Error("No image data found in response parts");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Google GenAI Image Gen Error: ${msg}`);
    }
  }
}

/**
 * Bytedance Standard Image Generation API (Seed4 / ByteArtist)
 */
export class BytedanceAfrProvider implements ImageProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, width, height, batchSize, options } = params;

    const API_CONFIG = {
      BASE_URL: process.env.GATEWAY_BASE_URL || "https://effect.bytedance.net",
      AID: process.env.BYTEDANCE_AID || "6834",
      APP_KEY:
        process.env.BYTEDANCE_APP_KEY || "a89de09e9bca4723943e8830a642464d",
      APP_SECRET:
        process.env.BYTEDANCE_APP_SECRET || "8505d553a24c485fb7d9bb336a3651a8",
    };

    const nonce = generateNonce();
    const timestamp = generateTimestamp();
    const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

    const queryParams = new URLSearchParams({
      aid: API_CONFIG.AID,
      app_key: API_CONFIG.APP_KEY,
      timestamp,
      nonce,
      sign,
    });

    const url = `${
      API_CONFIG.BASE_URL
    }/media/api/pic/afr?${queryParams.toString()}`;

    const isSeed42 = this.config.modelId === "seed4_2_lemo";
    const conf: Record<string, unknown> = {
      width: width || (isSeed42 ? 2048 : 1024),
      height: height || (isSeed42 ? 2048 : 1024),
      seed: options?.seed || Math.floor(Math.random() * 2147483647),
    };

    if (isSeed42) {
      conf["Prompt"] = prompt; // Capital P as requested
      conf["local_lora_name"] = "lemo_seed4_0104_doubao@v4.safetensors";
    } else {
      conf["prompt"] = prompt;
      conf["batch_size"] = batchSize || 1;
    }

    const formData = new URLSearchParams();
    formData.append("conf", JSON.stringify(conf));
    formData.append("algorithms", this.config.modelId); // Use modelId as the algorithm name
    formData.append("img_return_format", "png");

    if (params.image) {
      if (params.image.startsWith("http")) {
        formData.append("source", params.image);
      } else {
        const base64Data = params.image.includes(",")
          ? params.image.split(",")[1]
          : params.image;
        formData.append("base64file", base64Data);
      }
    }

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers: {
        "get-svc": "1",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ByteArtist-Client/1.0",
      },
      body: formData.toString(),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ByteArtist API Error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    const success =
      data.success ||
      data.message === "success" ||
      data.data?.algo_status_code === 0;

    if (!success) {
      console.error("==================", url, fetchOptions);
      throw new Error(
        `ByteArtist Generation Failed: ${
          data.message || data.algo_status_message
        } `
      );
    }

    const afr_data = (data.data?.data?.afr_data ??
      data.data?.afr_data ??
      []) as { pic: string }[];
    const images = afr_data.map((item) => {
      return item.pic.startsWith("http")
        ? item.pic
        : `data:image/png;base64,${item.pic}`;
    });

    return { images, metadata: data as Record<string, unknown> };
  }
}

/**
 * Coze Chat API Provider (for image generation bot)
 */
export class CozeImageProvider implements ImageProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, width, height, batchSize, image, images, options } = params;
    const isStream = options?.stream ?? false;

    const w = width || 1024;
    const h = height || 1024;
    const ar = this.getAspectRatio(w, h);

    // Construct parameters
    const parameters: Record<string, unknown> = {
      width: w,
      height: h,
      aspect_ratio: ar,
      batch_size: batchSize || 1,
    };

    // Handle reference images if provided
    if (image || (images && images.length > 0)) {
      parameters.reference_images = images || [image!];
    }
    // coze参数
    const contentArray: Array<{
      type: string;
      text?: string;
      file_url?: string;
      file_id?: string;
    }> = [
      {
        type: "text",
        text: `Prompt: ${prompt}\n\n[Parameters]\nwidth: ${w}\nheight: ${h}\naspect_ratio: ${ar}`,
      },
    ];

    // If there are reference images, upload them and add file_id to content
    const refImages = images || (image ? [image] : []);
    for (const imgUrl of refImages) {
      try {
        const fileId = await this.uploadToCoze(imgUrl);
        contentArray.push({
          type: "image",
          file_id: fileId,
        });
      } catch (err) {
        const truncatedUrl =
          imgUrl.length > 100 ? `${imgUrl.substring(0, 100)}...` : imgUrl;
        console.error(
          `[CozeImageProvider] Failed to upload image ${truncatedUrl}`,
          err
        );
        const errMsg = err instanceof Error ? err.message : String(err);
        // Truncate error message if it's too long (e.g. contains base64 data)
        const truncatedErrMsg =
          errMsg.length > 500 ? `${errMsg.substring(0, 500)}...` : errMsg;
        throw new Error(`文件上传失败: ${truncatedErrMsg}`);
      }
    }

    const body = {
      bot_id: this.config.modelId,
      user_id: "lemo_user_" + Math.random().toString(36).substring(7),
      stream: isStream,
      additional_messages: [
        {
          role: "user",
          content: JSON.stringify(contentArray),
          content_type: "object_string",
          type: "question",
        },
      ],
      parameters,
      // Many Coze Bots use custom_variables for these specific settings
      custom_variables: {
        width: String(w),
        height: String(h),
        aspect_ratio: ar,
      },
      enable_card: false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    const url = `${this.config.baseURL}`;
    console.log(
      `[CozeImageProvider] Sending request to: ${url} (stream: ${isStream})`
    );

    if (!isStream) {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coze API Error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return this.parseFullResponse(data);
    }

    // Streaming implementation
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Coze API Error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Coze Response body is not readable");

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const generatedImages: string[] = [];
    const stream = new ReadableStream({
      start: async (controller) => {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += textDecoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.startsWith("event:")) {
                // Event type handled if needed
              } else if (trimmed.startsWith("data:")) {
                const dataStr = trimmed.substring(5).trim();
                if (dataStr === "[DONE]") continue;

                try {
                  const data = JSON.parse(dataStr);

                  // Handle message delta for real-time text
                  if (
                    data.event === "conversation.message.delta" ||
                    (data.type === "answer" && data.content)
                  ) {
                    const content = data.content || data.message?.content;
                    if (content) {
                      controller.enqueue(
                        textEncoder.encode(
                          `data: ${JSON.stringify({ text: content })}\n\n`
                        )
                      );

                      // Real-time image extraction (especially for Coze where image might be in answer content)
                      const images = this.extractImagesFromContent(content);
                      images.forEach((img: string) => {
                        if (!generatedImages.includes(img)) {
                          generatedImages.push(img);
                          // Push to stream immediately for better UX
                          controller.enqueue(
                            textEncoder.encode(
                              `data: ${JSON.stringify({ images: [img] })}\n\n`
                            )
                          );
                        }
                      });
                    }
                  }

                  // Collect images from various event types
                  if (
                    data.event === "conversation.message.completed" ||
                    data.event === "conversation.chat.completed"
                  ) {
                    const msg = data.message || data.chat;
                    if (msg && msg.content) {
                      const images = this.extractImagesFromContent(msg.content);
                      images.forEach((img: string) => {
                        if (!generatedImages.includes(img))
                          generatedImages.push(img);
                      });
                    }
                  }

                  // Fallback for some Coze versions where data is the chat object
                  if (data.status === "completed" && data.messages) {
                    const res = this.parseFullResponse(data);
                    res.images.forEach((img: string) => {
                      if (!generatedImages.includes(img))
                        generatedImages.push(img);
                    });
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Send final images as a special SSE event
          if (generatedImages.length > 0) {
            controller.enqueue(
              textEncoder.encode(
                `data: ${JSON.stringify({ images: generatedImages })}\n\n`
              )
            );
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      images: [], // Images will come via stream
      stream,
      metadata: { isStream: true },
    };
  }

  private extractImagesFromContent(content: string): string[] {
    const generatedImages: string[] = [];
    // Regex to extract URLs, now accounting for potential "image:" prefix
    // We capture the URL part to easily strip the prefix if it exists
    const urlRegex =
      /(?:image:)?(https?:\/\/(?:[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|bmp)|[st]\.coze\.cn\/t\/[^\s"'<>]+))/gi;

    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      const url = match[1];
      if (!generatedImages.includes(url)) {
        generatedImages.push(url);
      }
    }

    // If content itself is a single URL (optionally with prefix), treat it as image
    let trimmed = content.trim();
    if (trimmed.startsWith("image:")) {
      trimmed = trimmed.substring(6).trim();
    }

    if (
      trimmed.startsWith("http") &&
      trimmed.includes("://") &&
      !trimmed.includes(" ") &&
      !generatedImages.includes(trimmed)
    ) {
      generatedImages.push(trimmed);
    }

    // Try JSON parse if content looks like JSON
    if (content.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.image_url) generatedImages.push(parsed.image_url);
        if (parsed.url) generatedImages.push(parsed.url);
        if (Array.isArray(parsed.output)) {
          parsed.output.forEach((url: string) => generatedImages.push(url));
        }
      } catch {
        /* not json */
      }
    }
    return generatedImages;
  }

  private parseFullResponse(data: Record<string, unknown>): ImageResult {
    const generatedImages: string[] = [];
    if (data.messages && Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        if (msg.role === "assistant") {
          const images = this.extractImagesFromContent(msg.content || "");
          images.forEach((img) => {
            if (!generatedImages.includes(img)) generatedImages.push(img);
          });
        }
      }
    }

    if (generatedImages.length === 0 && data.data && Array.isArray(data.data)) {
      data.data.forEach((item: { url?: string } | string) => {
        if (typeof item !== "string" && item.url)
          generatedImages.push(item.url);
        else if (typeof item === "string" && item.startsWith("http"))
          generatedImages.push(item);
      });
    }

    if (generatedImages.length === 0) {
      throw new Error("No images found in Coze response");
    }

    return {
      images: generatedImages,
      metadata: data,
    };
  }

  private async uploadToCoze(imageUrl: string): Promise<string> {
    console.log(`[CozeImageProvider] Uploading file to Coze...`);
    try {
      let blob: Blob;

      if (imageUrl.startsWith("data:")) {
        // 1. Handle Data URL (Base64)
        console.log(
          `[CozeImageProvider] Processing image from Data URL (Base64)`
        );
        const [header, base64Data] = imageUrl.split(",");
        const mimeMatch = header.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "image/png";
        const buffer = Buffer.from(base64Data, "base64");
        blob = new Blob([bufferToArrayBuffer(buffer)], { type: mime });
      } else if (imageUrl.startsWith("/")) {
        // 2. Handle local file paths
        const truncatedUrl =
          imageUrl.length > 100 ? `${imageUrl.substring(0, 100)}...` : imageUrl;
        console.log(
          `[CozeImageProvider] Processing image from local path: ${truncatedUrl}`
        );
        try {
          const publicPath = path.join(process.cwd(), "public", imageUrl);
          const buffer = await fs.readFile(publicPath);
          const ext = path.extname(publicPath).slice(1) || "png";
          const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
          blob = new Blob([bufferToArrayBuffer(buffer)], { type: mime });
        } catch (readErr) {
          console.error(
            `[CozeImageProvider] Failed to read local file, falling back to fetch`,
            readErr
          );
          // Fallback to fetch if local read fails (e.g. running in a restricted env)
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          const response = await fetch(`${baseUrl}${imageUrl}`);
          if (!response.ok)
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          const arrayBuffer = await response.arrayBuffer();
          const contentType =
            response.headers.get("content-type") || "image/png";
          blob = new Blob([arrayBuffer], { type: contentType });
        }
      } else if (imageUrl.startsWith("http")) {
        // 3. Handle external URLs
        const truncatedUrl =
          imageUrl.length > 100 ? `${imageUrl.substring(0, 100)}...` : imageUrl;
        console.log(
          `[CozeImageProvider] Processing image from external URL: ${truncatedUrl}`
        );
        const response = await fetch(imageUrl);
        if (!response.ok)
          throw new Error(
            `Failed to fetch image: ${response.status} ${response.statusText}`
          );
        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "image/png";
        blob = new Blob([arrayBuffer], { type: contentType });
      } else {
        // 4. Handle raw Base64 (without data prefix)
        console.log(
          `[CozeImageProvider] Processing image from raw Base64 string`
        );
        const buffer = Buffer.from(imageUrl, "base64");
        // Simple magic bytes check
        let mime = "image/png";
        if (buffer.length > 3) {
          if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
            mime = "image/jpeg";
          else if (
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47
          )
            mime = "image/png";
          else if (
            buffer[0] === 0x47 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46
          )
            mime = "image/gif";
          else if (
            buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46
          )
            mime = "image/webp";
        }
        blob = new Blob([bufferToArrayBuffer(buffer)], { type: mime });
      }

      // 4. Upload to Coze using FormData (multipart/form-data)
      let uploadUrl = "https://api.coze.cn/v1/files/upload";
      const baseURL = this.config.baseURL || "";
      if (baseURL.includes("coze.com")) {
        uploadUrl = "https://api.coze.com/v1/files/upload";
      } else if (baseURL.includes("bytedance.net")) {
        uploadUrl = "https://bot-open-api.bytedance.net/v1/files/upload";
      }

      const formData = new FormData();
      formData.append("file", blob, "image.png");

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          // Content-Type header is omitted to let fetch set the boundary
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(
          `Coze File Upload failed (${uploadResponse.status}): ${errorText}`
        );
      }

      const result = await uploadResponse.json();
      if (result.code !== 0) {
        throw new Error(`Coze File Upload API error: ${result.msg}`);
      }

      console.log(
        `[CozeImageProvider] File uploaded successfully, ID: ${result.data.id}`
      );
      return result.data.id;
    } catch (error) {
      console.error(`[CozeImageProvider] Error in uploadToCoze:`, error);
      throw error;
    }
  }

  private getAspectRatio(w: number, h: number): string {
    const ratio = w / h;
    if (Math.abs(ratio - 1) < 0.1) return "1:1";
    if (Math.abs(ratio - 1.33) < 0.1) return "4:3";
    if (Math.abs(ratio - 0.75) < 0.1) return "3:4";
    if (Math.abs(ratio - 1.77) < 0.1) return "16:9";
    if (Math.abs(ratio - 0.56) < 0.1) return "9:16";
    return `${w}:${h}`;
  }
}
