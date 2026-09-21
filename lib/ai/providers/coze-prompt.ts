import { TextProvider, VisionProvider, ModelConfig, TextGenerationInput, TextResult, VisionGenerationInput } from "../types";
import { CozePromptImagePayload, buildCozeImagePayload } from "./coze-image-input";
import { getProxyAgent } from "../utils";

const DEFAULT_LEMO_COZE_PROMPT_RUN_URL = "https://m5385m4ryw.coze.site/run";

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
