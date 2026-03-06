import { afterEach, describe, expect, it, vi } from "vitest";
import { CozePromptProvider } from "@/lib/ai/providers";

describe("CozePromptProvider", () => {
  const originalPromptToken = process.env.COZE_PROMPT_API_TOKEN;

  afterEach(() => {
    if (originalPromptToken === undefined) {
      delete process.env.COZE_PROMPT_API_TOKEN;
    } else {
      process.env.COZE_PROMPT_API_TOKEN = originalPromptToken;
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls coze run API for prompt optimization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: {
            output_text: "优化后的提示词",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozePromptProvider({
      providerId: "coze",
      modelId: "coze-prompt",
      apiKey: "test-token",
      baseURL: "https://bot-open-api.bytedance.net/v3/chat",
    });

    const result = await provider.generateText({
      input: "a cat on the table",
      systemPrompt: "optimize this prompt",
    });

    expect(result.text).toBe("优化后的提示词");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://m5385m4ryw.coze.site/run");

    const body = JSON.parse(String(options?.body));
    expect(body.image).toEqual({ url: "", file_type: "" });
    expect(body.text.mode).toBe("optimize");
    expect(body.text.prompt).toBe("a cat on the table");
    expect(body.text.system_prompt).toBe("optimize this prompt");
    expect(body.text.input).toContain("optimize this prompt");
  });

  it("supports describe payload with image + prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          message: {
            content: "这是一只白猫坐在木桌上。",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozePromptProvider({
      providerId: "coze",
      modelId: "coze-prompt",
      apiKey: "test-token",
      baseURL: "https://custom.coze.site/run",
    });

    const result = await provider.describeImage({
      image: "data:image/jpeg;base64,AAAA",
      prompt: "请描述图像内容",
      systemPrompt: "仅输出中文",
    });

    expect(result.text).toBe("这是一只白猫坐在木桌上。");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://custom.coze.site/run");

    const body = JSON.parse(String(options?.body));
    expect(body.image.file_type).toBe("jpeg");
    expect(body.image.url).toBe("data:image/jpeg;base64,AAAA");
    expect(body.text.mode).toBe("describe");
    expect(body.text.prompt).toBe("请描述图像内容");
    expect(body.text.system_prompt).toBe("仅输出中文");
  });

  it("prefers COZE_PROMPT_API_TOKEN over provider apiKey", async () => {
    process.env.COZE_PROMPT_API_TOKEN = "prompt-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozePromptProvider({
      providerId: "coze",
      modelId: "coze-prompt",
      apiKey: "legacy-token",
      baseURL: "https://custom.coze.site/run",
    });

    await provider.generateText({ input: "hello" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer prompt-token",
    });
  });
});
