import { TextProvider, ModelConfig, TextGenerationInput, TextResult } from "../types";
import { getProxyAgent } from "../utils";

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
