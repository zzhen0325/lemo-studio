import { ImageProvider, ModelConfig, ImageGenerationInput, ImageResult } from "../types";
import { uploadToCoze } from "../cozeUploader";
import { getProxyAgent } from "../utils";
import { extractImageUrlsFromString } from "./coze-image-output";

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
    // console.log(
    //   `[CozeImageProvider] Sending request to: ${url} (stream: ${isStream})`
    // );

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
        let accumulatedText = ""; // Track accumulated text for image extraction
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

              // console.log(`[CozeImageProvider] Received chunk: ${trimmed.substring(0, 100)}...`);

              if (trimmed.startsWith("event:")) {
                // Event type handled if needed
              } else if (trimmed.startsWith("data:")) {
                const dataStr = trimmed.substring(5).trim();
                if (dataStr === "[DONE]") continue;

                try {
                  const data = JSON.parse(dataStr);
                  // console.log(`[CozeImageProvider] parsed event: ${data.event || data.type}`);

                  // Handle message delta for real-time text
                  if (
                    data.event === "conversation.message.delta" ||
                    (data.type === "answer" && data.content)
                  ) {
                    const content = data.content || data.message?.content;
                    if (content) {
                      accumulatedText += content; // Accumulate text for image extraction
                      const sseData = `data: ${JSON.stringify({ text: content })}\n\n`;
                      controller.enqueue(textEncoder.encode(sseData));

                      // Real-time image extraction from accumulated text
                      const images = this.extractImagesFromContent(accumulatedText);
                      images.forEach((img: string) => {
                        if (!generatedImages.includes(img)) {
                          generatedImages.push(img);
                          // Push to stream immediately for better UX
                          const imgSseData = `data: ${JSON.stringify({ images: [img] })}\n\n`;
                          // console.log(`[CozeImageProvider] Enqueueing image SSE: ${imgSseData.substring(0, 100)}...`);
                          controller.enqueue(textEncoder.encode(imgSseData));
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

    // 1. Match Coze short URLs - must end with a slash /
    // Use [a-zA-Z0-9_-] to avoid consuming "image:http..." as part of the path
    const cozeRegex = /https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//gi;
    let match;
    while ((match = cozeRegex.exec(content)) !== null) {
      if (!generatedImages.includes(match[0])) {
        generatedImages.push(match[0]);
      }
    }

    // 2. Match regular image URLs with extensions
    const fileRegex =
      /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/gi;
    while ((match = fileRegex.exec(content)) !== null) {
      if (!generatedImages.includes(match[0])) {
        generatedImages.push(match[0]);
      }
    }

    // 3. Fallback for content that might be split by "image:"
    const parts = content.split(/image:/i);
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (
        trimmedPart.startsWith("http") &&
        !trimmedPart.includes(" ") &&
        (trimmedPart.includes("coze.cn/t/") || /\.(?:png|jpg|jpeg|gif|webp|bmp)$/i.test(trimmedPart))
      ) {
        // Ensure the Coze URL part is clean if it was followed by something else
        let finalUrl = trimmedPart;
        if (trimmedPart.includes("coze.cn/t/")) {
          const cozeMatch = trimmedPart.match(/https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//i);
          if (cozeMatch) {
            finalUrl = cozeMatch[0];
          } else {
            // If it looks like a Coze URL but doesn't match the strict regex (e.g. incomplete), skip it
            continue;
          }
        }

        if (!generatedImages.includes(finalUrl)) {
          generatedImages.push(finalUrl);
        }
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
      data.data.forEach((item: unknown) => {
        if (typeof item === "string") {
          extractImageUrlsFromString(item).forEach((candidate) => {
            if (!generatedImages.includes(candidate)) {
              generatedImages.push(candidate);
            }
          });
          return;
        }

        if (!item || typeof item !== "object") return;
        const record = item as Record<string, unknown>;
        const candidates = [
          record.url,
          record.image_url,
          record.imageUrl,
          record.output,
        ];

        candidates.forEach((candidate) => {
          if (typeof candidate !== "string") return;
          extractImageUrlsFromString(candidate).forEach((resolved) => {
            if (!generatedImages.includes(resolved)) {
              generatedImages.push(resolved);
            }
          });
        });
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
    try {
      return await uploadToCoze(
        imageUrl,
        this.config.apiKey,
        this.config.baseURL || ""
      );
    } catch (error) {
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

export { CozeWorkflowImageProvider } from './coze-workflow-image';
