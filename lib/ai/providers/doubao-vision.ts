import { TextProvider, VisionProvider, ModelConfig, TextGenerationInput, TextResult, VisionGenerationInput } from "../types";
import { getProxyAgent } from "../utils";

type DoubaoResponseContentItem = { type?: string; text?: string };

type DoubaoResponseOutputItem = {
  type?: string;
  content?: DoubaoResponseContentItem[];
};

type DoubaoResponse = {
  output?: DoubaoResponseOutputItem[];
  output_text?: string | string[];
};

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
