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
} from "../types";
import {
  getProxyAgent,
  getUndiciDispatcher,
  generateSign,
  generateNonce,
  generateTimestamp,
} from "../utils";
import { getConfiguredSiteBaseUrl, readLocalPublicImage } from "../imageInput";
import { uploadToCoze } from "../cozeUploader";
import { getFileUrl } from "@/src/storage/object-storage";

type DoubaoResponseContentItem = { type?: string; text?: string };
type DoubaoResponseOutputItem = {
  type?: string;
  content?: DoubaoResponseContentItem[];
};
type DoubaoResponse = {
  output?: DoubaoResponseOutputItem[];
  output_text?: string | string[];
};

const DEFAULT_LEMO_COZE_PROMPT_RUN_URL = "https://m5385m4ryw.coze.site/run";
const DEFAULT_LEMO_COZE_SEED_RUN_URL = "https://2q3rqt6rnh.coze.site/run";

type CozePromptImagePayload = {
  url: string;
  file_type: string;
};

type CozeWorkflowReferenceImagesPayload = string[];

const warnedBytedanceAfrFallback = new Set<string>();

function getRequestHost(input: string): string {
  try {
    return new URL(input).host;
  } catch {
    return "";
  }
}

function countRelativeImageInputs(inputs: string[]): number {
  return inputs.filter((item) => typeof item === "string" && item.startsWith("/")).length;
}

function logProviderEvent(provider: string, event: string, payload: Record<string, unknown>) {
  if (process.env.DEBUG_AI_PROVIDER === "1") {
    console.info(`[AIProvider][${provider}] ${event}`, payload);
  }
}

function resolveBytedanceAfrConfig() {
  const configured = {
    baseUrl: process.env.GATEWAY_BASE_URL?.trim() || "",
    aid: process.env.BYTEDANCE_AID?.trim() || "",
    appKey: process.env.BYTEDANCE_APP_KEY?.trim() || "",
    appSecret: process.env.BYTEDANCE_APP_SECRET?.trim() || "",
  };
  const missing = Object.entries({
    GATEWAY_BASE_URL: configured.baseUrl,
    BYTEDANCE_AID: configured.aid,
    BYTEDANCE_APP_KEY: configured.appKey,
    BYTEDANCE_APP_SECRET: configured.appSecret,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(`Missing ByteDance AFR environment variables: ${missing.join(", ")}`);
  }

  if (missing.length > 0) {
    const warningKey = missing.join(",");
    if (!warnedBytedanceAfrFallback.has(warningKey)) {
      warnedBytedanceAfrFallback.add(warningKey);
      console.warn("[AIProvider][bytedance-afr] Using development fallback config. Set explicit env vars before production deploy.", {
        missing,
      });
    }
  }

  return {
    BASE_URL: configured.baseUrl || "https://lv-api-lf.ulikecam.com",
    AID: configured.aid || "6834",
    APP_KEY: configured.appKey || "a89de09e9bca4723943e8830a642464d",
    APP_SECRET: configured.appSecret || "8505d553a24c485fb7d9bb336a3651a8",
    missing,
  };
}

function extractDoubaoOutputText(data: DoubaoResponse): string {
  const outputs = Array.isArray(data.output) ? data.output : [];

  // Preferred path: message node contains final output_text.
  const messageOutput = outputs.find((item) => item?.type === "message");
  const messageText = messageOutput?.content?.find(
    (content) => content?.type === "output_text" && typeof content.text === "string"
  )?.text;
  if (messageText) {
    return messageText;
  }

  // Fallback: some models may put output_text in other output nodes.
  for (const output of outputs) {
    const text = output?.content?.find(
      (content) => content?.type === "output_text" && typeof content.text === "string"
    )?.text;
    if (text) {
      return text;
    }
  }

  if (typeof data.output_text === "string") {
    return data.output_text;
  }
  if (Array.isArray(data.output_text)) {
    return data.output_text.join("");
  }

  return "";
}

function isLikelyBase64(value: string): boolean {
  if (!value || value.length < 24) return false;
  const sanitized = value.replace(/\s+/g, "");
  return /^[A-Za-z0-9+/=]+$/.test(sanitized);
}

async function buildCozeImagePayload(imageInput: string): Promise<CozePromptImagePayload> {
  if (!imageInput) {
    throw new Error("Coze API requires image input");
  }

  if (imageInput.startsWith("data:")) {
    return {
      url: imageInput,
      file_type: "image",
    };
  }

  if (imageInput.startsWith("/")) {
    const localImage = await readLocalPublicImage(imageInput);
    if (!localImage) {
      throw new Error(`Invalid local image path: ${imageInput}`);
    }
    return {
      url: `data:${localImage.mimeType};base64,${localImage.data}`,
      file_type: "image",
    };
  }

  if (/^https?:\/\//i.test(imageInput)) {
    return {
      url: imageInput,
      file_type: "image",
    };
  }

  if (isLikelyBase64(imageInput)) {
    const sanitized = imageInput.replace(/\s+/g, "");
    return {
      url: `data:image/png;base64,${sanitized}`,
      file_type: "image",
    };
  }

  // 尝试作为对象存储 key 处理（生成预签名 URL）
  // 对象存储 key 通常不包含 :// 且不是 data URL、base64、本地路径
  try {
    const presignedUrl = await getFileUrl(imageInput, 3600); // 1小时过期
    console.info('[buildCozeImagePayload] resolved_storage_key_to_presigned_url', {
      key: imageInput,
      resolvedUrl: presignedUrl.substring(0, 50) + '...',
    });
    return {
      url: presignedUrl,
      file_type: "image",
    };
  } catch (error) {
    console.warn('[buildCozeImagePayload] failed_to_resolve_storage_key', {
      key: imageInput,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  throw new Error("Unsupported image input for Coze API");
}

function pushUniqueImage(images: string[], candidate: string): void {
  const value = candidate.trim();
  if (!value || images.includes(value)) return;
  images.push(value);
}

function extractImageUrlsFromString(input: string): string[] {
  const images: string[] = [];
  const value = input.trim();
  if (!value) return images;

  if (value.startsWith("data:image/")) {
    pushUniqueImage(images, value);
  } else if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) {
    pushUniqueImage(images, value);
  } else if (isLikelyBase64(value)) {
    pushUniqueImage(images, `data:image/png;base64,${value.replace(/\s+/g, "")}`);
  }

  const cozeRegex = /https?:\/\/[st]\.coze\.cn\/t\/[a-zA-Z0-9_-]+\//gi;
  let match: RegExpExecArray | null;
  while ((match = cozeRegex.exec(value)) !== null) {
    pushUniqueImage(images, match[0]);
  }

  const fileRegex =
    /https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s"'<>]*)?(?:#[^\s"'<>]*)?/gi;
  while ((match = fileRegex.exec(value)) !== null) {
    pushUniqueImage(images, match[0]);
  }

  return images;
}

function extractCozeWorkflowImageUrls(payload: unknown): string[] {
  const images: string[] = [];
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  const preferredKeys = [
    "url",
    "image",
    "image_url",
    "imageUrl",
    "images",
    "generated_image_urls",
    "output",
    "result",
    "data",
    "content",
    "message",
    "response",
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === "string") {
      for (const candidate of extractImageUrlsFromString(current)) {
        pushUniqueImage(images, candidate);
      }
      continue;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string") {
        for (const candidate of extractImageUrlsFromString(value)) {
          pushUniqueImage(images, candidate);
        }
      } else if (value !== undefined) {
        queue.push(value);
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === "string" || typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return images;
}

function buildCozePromptTextPayload(params: {
  input: string;
  systemPrompt?: string;
}): string {
  const input = params.input.trim();
  const systemPrompt = (params.systemPrompt || "").trim();
  return systemPrompt ? `${systemPrompt}\n\n${input}` : input;
}

function extractCozePromptText(payload: unknown): string {
  const preferredKeys = [
    "text",
    "output_text",
    "output",
    "result",
    "answer",
    "content",
    "message",
    "response",
    "data",
  ];

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();
  let fallbackUrl = "";

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === "string") {
      const value = current.trim();
      if (!value) continue;

      if (/^https?:\/\//i.test(value) && !fallbackUrl) {
        fallbackUrl = value;
        continue;
      }

      return value;
    }

    if (typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const record = current as Record<string, unknown>;
    const role = typeof record.role === "string" ? record.role.toLowerCase() : "";
    if (role === "assistant" && typeof record.content === "string" && record.content.trim()) {
      return record.content.trim();
    }

    for (const key of preferredKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        if (/^https?:\/\//i.test(value) && !fallbackUrl) {
          fallbackUrl = value.trim();
          continue;
        }
        return value.trim();
      }
    }

    for (const key of preferredKeys) {
      if (record[key] !== undefined) queue.push(record[key]);
    }
    for (const value of Object.values(record)) {
      if (typeof value === "string" || typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return fallbackUrl;
}

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

    const data = (await response.json()) as DoubaoResponse;
    const text = extractDoubaoOutputText(data);
    if (!text.trim()) {
      const outputTypes = Array.isArray(data.output)
        ? data.output.map((item) => item?.type || "unknown").join(",")
        : "none";
      throw new Error(
        `Doubao API returned empty output_text (output types: ${outputTypes})`
      );
    }

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

    const data = (await response.json()) as DoubaoResponse;
    const text = extractDoubaoOutputText(data);
    if (!text.trim()) {
      const outputTypes = Array.isArray(data.output)
        ? data.output.map((item) => item?.type || "unknown").join(",")
        : "none";
      throw new Error(
        `Doubao Vision returned empty output_text (output types: ${outputTypes}). Please verify image input.`
      );
    }

    return { text };
  }
}

type GooglePart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export class GoogleGenAIProvider
  implements TextProvider, VisionProvider, ImageProvider {
  private apiKey: string;
  private modelId: string;
  private baseURL = "https://generativelanguage.googleapis.com/v1beta";

  constructor(config: ModelConfig) {
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
    const dispatcher = getUndiciDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    };

    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    try {
      const response = await fetch(url, fetchOptions);

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

    const parts: GooglePart[] = [];

    // Handle image
    try {
      const imagePart = await this.prepareImagePart(image);
      parts.push(imagePart);
    } catch (err) {
      console.error(`[GoogleGenAIProvider] Error preparing image:`, err);
      throw new Error(`无法处理图片: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (systemPrompt) parts.push({ text: systemPrompt });
    if (prompt) parts.push({ text: prompt });

    const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;
    const dispatcher = getUndiciDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    };

    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    try {
      const response = await fetch(url, fetchOptions);

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

  private async prepareImagePart(img: string): Promise<{ inline_data: { mime_type: string; data: string } }> {
    let base64Data = img;
    let mimeType = "image/png";

    if (img.startsWith("data:")) {
      const matches = img.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        const parts = img.split(",");
        if (parts.length > 1) {
          mimeType = parts[0].split(":")[1].split(";")[0];
          base64Data = parts[1];
        }
      }
    } else if (img.startsWith("/") && img.length < 2048) {
      try {
        const localImage = await readLocalPublicImage(img);
        if (!localImage) {
          const siteBaseUrl = getConfiguredSiteBaseUrl();
          throw new Error(`Cannot resolve relative image path: ${img}${siteBaseUrl ? ` (site base: ${siteBaseUrl})` : " (configure NEXT_PUBLIC_BASE_URL on the backend for split deployments)"}`);
        }
        base64Data = localImage.data;
        mimeType = localImage.mimeType;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Read local image failed: ${msg}`);
      }
    } else if (img.startsWith("http")) {
      // 下载并转换为 base64
      const dispatcher = getUndiciDispatcher();
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {};
      if (dispatcher) {
        fetchOptions.dispatcher = dispatcher;
      }
      try {
        const resp = await fetch(img, fetchOptions);
        if (!resp.ok) throw new Error(`status=${resp.status}`);
        const buffer = await resp.arrayBuffer();
        base64Data = Buffer.from(buffer).toString('base64');
        const contentType = resp.headers.get('content-type');
        if (contentType) mimeType = contentType;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Fetch image failed: ${msg}`);
      }
    }

    return {
      inline_data: {
        mime_type: mimeType,
        data: base64Data,
      },
    };
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, aspectRatio, imageSize, image, images } = params;
    const parts: GooglePart[] = [];

    // 优先使用 images 数组，回退到单个 image
    const imageList = (images && images.length > 0) ? images : (image ? [image] : []);

    if (imageList.length > 0) {

      for (const img of imageList) {
        try {
          const imagePart = await this.prepareImagePart(img);
          parts.push(imagePart);
        } catch (err) {
          console.error(`[GoogleGenAIProvider] Error fetching remote image: ${img}`, err);
          const reason = err instanceof Error ? err.message : String(err);
          throw new Error(`无法获取远程图片进行生成: ${img}（${reason}）。若处于内网环境，请优先使用本地上传图片，或配置 HTTP_PROXY/HTTPS_PROXY。`);
        }
      }
    }

    parts.push({ text: prompt });

    const configParams: Record<string, unknown> = {
      responseModalities: ["Image"] as const, // 官方 REST 文档使用 "Image"
    };

    const supportsImageSize = Boolean(imageSize && this.modelId.startsWith("gemini-"));
    if (aspectRatio || supportsImageSize) {
      configParams.imageConfig = {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(supportsImageSize ? { imageSize } : {}),
      };
    }

    const url = `${this.baseURL}/models/${this.modelId}:generateContent?key=${this.apiKey}`;
    // Note: agent unused here, dispatcher used for undici
    const body = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: configParams,
    });
    // console.log(`[GoogleGenAIProvider] Request body: ${body}`);
    const dispatcher = getUndiciDispatcher();
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    };

    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    const startedAt = Date.now();
    logProviderEvent("google-genai", "image_request_start", {
      modelId: this.modelId,
      host: getRequestHost(url),
      imageCount: imageList.length,
      relativeImageCount: countRelativeImageInputs(imageList),
      imageSize: imageSize || null,
      aspectRatio: aspectRatio || null,
    });

    try {
      const response = await fetch(url, fetchOptions);

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
        // Handle both snake_case and camelCase response from Google (they sometimes vary)
        const inlineData = part.inline_data || part.inlineData;
        if (inlineData && inlineData.data) {
          const dataUrl = `data:${inlineData.mime_type || inlineData.mimeType || "image/png"
            };base64,${inlineData.data}`;
          logProviderEvent("google-genai", "image_request_success", {
            modelId: this.modelId,
            host: getRequestHost(url),
            elapsedMs: Date.now() - startedAt,
            imageCount: imageList.length,
          });
          return { images: [dataUrl] };
        }
      }
      throw new Error("No image data found in response parts");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[AIProvider][google-genai] image_request_error", {
        modelId: this.modelId,
        host: getRequestHost(url),
        elapsedMs: Date.now() - startedAt,
        imageCount: imageList.length,
        relativeImageCount: countRelativeImageInputs(imageList),
        error: msg,
      });
      throw new Error(`Google GenAI Image Gen Error: ${msg}`);
    }
  }
}

/**
 * Coze Prompt API Provider (https://*.coze.site/run)
 * 用于 prompt 优化（text）和图片描述（vision）。
 */
export class CozePromptProvider implements TextProvider, VisionProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateText(params: TextGenerationInput): Promise<TextResult> {
    const input = params.input?.trim();
    if (!input) {
      throw new Error("Coze Prompt API requires non-empty input");
    }

    const body = {
      text: buildCozePromptTextPayload({
        input,
        systemPrompt: params.systemPrompt,
      }),
    };

    const text = await this.callRunApi(body);
    return { text };
  }

  async describeImage(params: VisionGenerationInput): Promise<TextResult> {
    const image = await this.buildImagePayload(params.image);
    const prompt = (params.prompt || "请描述这张图片").trim();

    const body = {
      image,
      text: buildCozePromptTextPayload({
        input: prompt,
        systemPrompt: params.systemPrompt,
      }),
    };

    const text = await this.callRunApi(body);
    return { text };
  }

  private resolveRunUrl(): string {
    const configured = this.config.baseURL?.trim();
    if (configured && configured.includes("/run")) {
      return configured;
    }
    return process.env.LEMO_COZE_PROMPT_RUN_URL || DEFAULT_LEMO_COZE_PROMPT_RUN_URL;
  }

  private async buildImagePayload(imageInput: string): Promise<CozePromptImagePayload> {
    return buildCozeImagePayload(imageInput);
  }

  private async callRunApi(payload: {
    image?: CozePromptImagePayload;
    text: string;
  }): Promise<string> {
    const resolvedApiKey = this.resolveApiKey();
    const resolvedRunUrl = this.resolveRunUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (resolvedApiKey) {
      headers.Authorization = `Bearer ${resolvedApiKey}`;
    }

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    console.info("[AIProvider][coze-prompt] run_api_request", {
      url: resolvedRunUrl,
      hasApiKey: Boolean(resolvedApiKey),
      hasImage: Boolean(payload.image),
      textLength: payload.text.length,
    });

    const response = await fetch(resolvedRunUrl, fetchOptions);
    const raw = await response.text();

    if (!response.ok) {
      const truncatedError = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
      throw new Error(`Coze Prompt API Error: ${response.status} - ${truncatedError}`);
    }

    let parsed: unknown = raw;
    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    const text = extractCozePromptText(parsed).trim();
    if (!text) {
      const truncatedPayload = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
      throw new Error(`Coze Prompt API returned empty text: ${truncatedPayload}`);
    }

    return text;
  }

  private resolveApiKey(): string {
    return process.env.LEMO_COZE_PROMPT_API_TOKEN || this.config.apiKey || process.env.LEMO_COZE_API_TOKEN || "";
  }
}

export class CozeWorkflowImageProvider implements ImageProvider {
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, width, height, imageSize, image, images } = params;
    const resolvedApiKey = this.resolveApiKey();
    if (!resolvedApiKey) {
      throw new Error("Missing LEMO_COZE_SEED_API_TOKEN for Coze workflow image generation");
    }

    const refInputs = (images && images.length > 0) ? images : (image ? [image] : []);
    const body = {
      prompt: prompt || "",
      reference_images: await this.buildReferenceImagesPayload(refInputs),
      size: this.resolveSize(width, height, imageSize),
      watermark: false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedApiKey}`,
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

    const runUrl = this.resolveRunUrl();
    const startedAt = Date.now();
    logProviderEvent("coze-workflow", "image_request_start", {
      modelId: this.config.modelId,
      host: getRequestHost(runUrl),
      imageCount: refInputs.length,
      relativeImageCount: countRelativeImageInputs(refInputs),
      size: body.size,
    });

    const response = await fetch(runUrl, fetchOptions);
    const raw = await response.text();

    if (!response.ok) {
      const truncatedError = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
      console.error("[AIProvider][coze-workflow] image_request_error", {
        modelId: this.config.modelId,
        host: getRequestHost(runUrl),
        elapsedMs: Date.now() - startedAt,
        imageCount: refInputs.length,
        relativeImageCount: countRelativeImageInputs(refInputs),
        status: response.status,
        error: truncatedError,
      });
      throw new Error(`Coze Seed workflow API Error: ${response.status} - ${truncatedError}`);
    }

    let parsed: unknown = raw;
    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    const resolvedImages = extractCozeWorkflowImageUrls(parsed);
    if (resolvedImages.length === 0) {
      const truncatedPayload = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
      throw new Error(`Coze Seed workflow returned no images: ${truncatedPayload}`);
    }

    logProviderEvent("coze-workflow", "image_request_success", {
      modelId: this.config.modelId,
      host: getRequestHost(runUrl),
      elapsedMs: Date.now() - startedAt,
      imageCount: refInputs.length,
      outputCount: resolvedImages.length,
    });

    return {
      images: resolvedImages,
      metadata: (typeof parsed === "object" && parsed)
        ? (parsed as Record<string, unknown>)
        : { raw },
    };
  }

  private resolveRunUrl(): string {
    const configured = this.config.baseURL?.trim();
    if (configured && configured.includes("/run")) {
      return configured;
    }
    return process.env.LEMO_COZE_SEED_RUN_URL || DEFAULT_LEMO_COZE_SEED_RUN_URL;
  }

  private resolveApiKey(): string {
    return process.env.LEMO_COZE_SEED_API_TOKEN || this.config.apiKey || "";
  }

  private async buildReferenceImagesPayload(inputs: string[]): Promise<CozeWorkflowReferenceImagesPayload> {
    return Promise.all(inputs.map(async (item) => {
      const payload = await buildCozeImagePayload(item);
      return payload.url;
    }));
  }

  private resolveSize(width?: number, height?: number, imageSize?: string): string {
    if (Number.isFinite(width) && Number.isFinite(height) && Number(width) > 0 && Number(height) > 0) {
      return `${Math.round(Number(width))}x${Math.round(Number(height))}`;
    }

    const normalized = (imageSize || "").trim().toUpperCase();
    if (normalized === "1K") return "1024x1024";
    if (normalized === "2K") return "2048x2048";
    if (normalized === "4K") return "4096x4096";
    if (/^\d+\s*x\s*\d+$/i.test(normalized)) {
      return normalized.replace(/\s+/g, "");
    }

    return "1024x1024";
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

  /**
   * 提交图片生成任务
   * 使用 submit_task_v2 接口
   */
  private async submitTask(params: {
    prompt: string;
    width: number;
    height: number;
    image?: string;
  }): Promise<string> {
    const { prompt, width, height, image } = params;
    const API_CONFIG = resolveBytedanceAfrConfig();

    const submitUrl = `${API_CONFIG.BASE_URL}/media/api/pic/submit_task_v2`;

    // 构建 req_json
    const reqJson: Record<string, unknown> = {
      width,
      height,
      seed: -1,
    };
    if (this.config.modelId === "seed4_0402_v4_lemo") {
      reqJson.Prompt = prompt;
    } else {
      reqJson.string = prompt;
    }

    // 生成签名参数
    const nonce = generateNonce();
    const timestamp = generateTimestamp();
    const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

    const formData = new URLSearchParams();
    formData.append("aid", API_CONFIG.AID);
    formData.append("app_key", API_CONFIG.APP_KEY);
    formData.append("nonce", nonce);
    formData.append("timestamp", timestamp);
    formData.append("sign", sign);
    formData.append("req_key", this.config.modelId);
    formData.append("req_json", JSON.stringify(reqJson));
    formData.append("img_return_type", "url");
    formData.append("img_return_format", "png");
    formData.append("expired_duration", "600");

    // 处理参考图片
    if (image) {
      if (image.startsWith("http")) {
        formData.append("image_url", image);
      } else if (image.startsWith("data:")) {
        // base64 data URL
        const base64Data = image.split(",")[1];
        formData.append("image_data", base64Data);
      } else {
        // 纯 base64
        formData.append("image_data", image);
      }
    }

    const agent = getProxyAgent();
    const fetchOptions: RequestInit & { agent?: unknown } = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    };

    if (agent) {
      fetchOptions.agent = agent;
    }

    logProviderEvent("bytedance-afr", "submit_task_start", {
      modelId: this.config.modelId,
      host: getRequestHost(submitUrl),
      width,
      height,
      usingFallbackConfig: API_CONFIG.missing.length > 0,
    });

    const response = await fetch(submitUrl, fetchOptions);
    const data = await response.json() as { data?: { task_id?: string }; message?: string; status_code?: number };

    if (!response.ok || data.status_code !== 0) {
      console.error("[AIProvider][bytedance-afr] submit_task_error", {
        modelId: this.config.modelId,
        host: getRequestHost(submitUrl),
        status: response.status,
        statusCode: data.status_code,
        message: data.message,
      });
      throw new Error(`Submit task failed: ${data.message || response.status}`);
    }

    const taskId = data.data?.task_id;
    if (!taskId) {
      throw new Error("No task_id returned from submit_task_v2");
    }

    logProviderEvent("bytedance-afr", "submit_task_success", {
      modelId: this.config.modelId,
      taskId,
    });

    return taskId;
  }

  /**
   * 轮询获取任务结果
   * 使用 batch_get_result_v2 接口
   */
  private async pollForResult(taskId: string): Promise<string[]> {
    const API_CONFIG = resolveBytedanceAfrConfig();
    const pollUrl = `${API_CONFIG.BASE_URL}/media/api/pic/batch_get_result_v2`;

    // 轮询配置
    const maxAttempts = 120; // 最多轮询 120 次
    const pollInterval = 1000; // 每秒轮询一次

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 每次请求都生成新的签名参数
      const nonce = generateNonce();
      const timestamp = generateTimestamp();
      const sign = generateSign(nonce, timestamp, API_CONFIG.APP_SECRET);

      const formData = new URLSearchParams();
      formData.append("aid", API_CONFIG.AID);
      formData.append("app_key", API_CONFIG.APP_KEY);
      formData.append("nonce", nonce);
      formData.append("timestamp", timestamp);
      formData.append("sign", sign);
      formData.append("req_key", this.config.modelId);
      formData.append("task_ids", taskId);
      formData.append("img_return_type", "url");
      formData.append("img_return_format", "png");

      const agent = getProxyAgent();
      const fetchOptions: RequestInit & { agent?: unknown } = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      };

      if (agent) {
        fetchOptions.agent = agent;
      }

      const response = await fetch(pollUrl, fetchOptions);
      const data = await response.json() as {
        data?: {
          results?: Array<{
            status?: number | string;
            pic_urls?: Array<{ main_url?: string; backup_url?: string }>;
            binary_data?: string[];
            message?: string;
          }>;
        };
        status_code?: number;
        message?: string;
      };

      if (!response.ok || data.status_code !== 0) {
        console.error("[AIProvider][bytedance-afr] poll_result_error", {
          modelId: this.config.modelId,
          taskId,
          attempt,
          status: response.status,
          statusCode: data.status_code,
          message: data.message,
        });
        throw new Error(`Poll result failed: ${data.message || response.status}`);
      }

      const result = data.data?.results?.[0];
      
      if (result) {
        // 判断任务是否完成
        // status 可能是数字 (1) 或字符串 ("done")
        const status = result.status;
        const isDone = status === 'done' || status === 1 || status === 'DONE';
        
        if (isDone) {
          // 优先取 pic_urls
          const picUrls = result.pic_urls;
          if (picUrls && picUrls.length > 0) {
            const images: string[] = [];
            for (const p of picUrls) {
              // 优先 main_url，其次 backup_url
              const url = p.main_url || p.backup_url;
              if (url) {
                images.push(url);
              }
            }
            
            if (images.length > 0) {
              logProviderEvent("bytedance-afr", "poll_result_success", {
                modelId: this.config.modelId,
                taskId,
                attempt,
                imageCount: images.length,
                status: String(status),
              });
              return images;
            }
          }
          
          // 如果有 binary_data，转换为 data URL
          if (result.binary_data && result.binary_data.length > 0) {
            const images = result.binary_data.map(b64 => `data:image/png;base64,${b64}`);
            logProviderEvent("bytedance-afr", "poll_result_success", {
              modelId: this.config.modelId,
              taskId,
              attempt,
              imageCount: images.length,
              status: String(status),
              source: 'binary_data',
            });
            return images;
          }
          
          // 完成但无图片
          throw new Error(`Task completed but no image data: ${result.message || "No pic_urls or binary_data"}`);
        }

        // 任务失败状态
        if (status === 'failed' || status === 2 || status === 'FAILED') {
          throw new Error(`Task failed: ${result.message || "Unknown error"}`);
        }
        
        // 处理中，记录日志
        if (attempt % 5 === 0) {
          logProviderEvent("bytedance-afr", "poll_result_pending", {
            modelId: this.config.modelId,
            taskId,
            attempt,
            status: String(status),
          });
        }
      }

      // 还在处理中，等待后继续轮询
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Poll timeout: task ${taskId} did not complete within ${maxAttempts} seconds`);
  }

  async generateImage(params: ImageGenerationInput): Promise<ImageResult> {
    const { prompt, width, height, imageSize, image, images } = params;
    const API_CONFIG = resolveBytedanceAfrConfig();
    const startedAt = Date.now();

    // 计算实际尺寸
    const actualWidth = width || this.getWidthFromImageSize(imageSize);
    const actualHeight = height || this.getHeightFromImageSize(imageSize);

    // 处理参考图片
    const refImage = (images && images.length > 0) ? images[0] : image;

    logProviderEvent("bytedance-afr", "image_request_start", {
      modelId: this.config.modelId,
      host: getRequestHost(API_CONFIG.BASE_URL),
      width: actualWidth,
      height: actualHeight,
      hasImage: !!refImage,
      usingFallbackConfig: API_CONFIG.missing.length > 0,
    });

    try {
      // 1. 提交任务
      const taskId = await this.submitTask({
        prompt: prompt || "",
        width: actualWidth,
        height: actualHeight,
        image: refImage,
      });

      // 2. 轮询获取结果
      const imageUrls = await this.pollForResult(taskId);

      logProviderEvent("bytedance-afr", "image_request_success", {
        modelId: this.config.modelId,
        host: getRequestHost(API_CONFIG.BASE_URL),
        elapsedMs: Date.now() - startedAt,
        imageCount: imageUrls.length,
        taskId,
      });

      return {
        images: imageUrls,
        metadata: { taskId, width: actualWidth, height: actualHeight },
      };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const errorInfo: Record<string, unknown> = {
        modelId: this.config.modelId,
        provider: "bytedance-afr",
        host: getRequestHost(API_CONFIG.BASE_URL),
        elapsedMs,
        usingFallbackConfig: API_CONFIG.missing.length > 0,
        missingEnvVars: API_CONFIG.missing.length > 0 ? API_CONFIG.missing : undefined,
      };

      if (error instanceof Error) {
        errorInfo.error = error.message;
        if (error.cause) {
          errorInfo.cause = String(error.cause);
        }
        if (error instanceof AggregateError) {
          errorInfo.errors = error.errors.map((e, i) => `[${i + 1}] ${e.message || e}`).join("; ");
        }
      }

      console.error("[AIProvider][bytedance-afr] image_request_failed", errorInfo);
      throw error;
    }
  }

  private getWidthFromImageSize(imageSize?: string): number {
    switch (imageSize) {
      case "1K":
        return 1024;
      case "2K":
        return 2048;
      default:
        return 1024;
    }
  }

  private getHeightFromImageSize(imageSize?: string): number {
    switch (imageSize) {
      case "1K":
        return 1024;
      case "2K":
        return 2048;
      default:
        return 1024;
    }
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
