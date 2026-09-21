import { TextProvider, VisionProvider, ImageProvider, ModelConfig, TextGenerationInput, TextResult, VisionGenerationInput, ImageGenerationInput, ImageResult } from "../types";
import { getUndiciDispatcher } from "../utils";
import { readLocalPublicImage, getConfiguredSiteBaseUrl } from "../imageInput";
import { logProviderEvent, getRequestHost, countRelativeImageInputs } from "./provider-diagnostics";

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
