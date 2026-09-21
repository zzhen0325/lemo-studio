import { ImageProvider, ModelConfig, ImageGenerationInput, ImageResult } from "../types";
import { getProxyAgent } from "../utils";
import { logProviderEvent, getRequestHost, countRelativeImageInputs } from "./provider-diagnostics";
import { createCozeWorkflowHttpError } from "./coze-workflow-errors";
import { extractCozeWorkflowImageUrls } from "./coze-image-output";
import { buildCozeImagePayload } from "./coze-image-input";

const DEFAULT_LEMO_COZE_SEED_RUN_URL = "https://2q3rqt6rnh.coze.site/run";

type CozeWorkflowReferenceImagesPayload = string[];

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
      throw createCozeWorkflowHttpError({ status: response.status, raw });
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
