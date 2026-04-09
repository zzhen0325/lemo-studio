import { afterEach, describe, expect, it, vi } from "vitest";
import type { APIProviderConfig } from "@/lib/api-config/types";
import { CozeWorkflowImageProvider } from "@/lib/ai/providers";
import { getProvider } from "@/lib/ai/modelRegistry";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX6sAAAAASUVORK5CYII=";

describe("CozeWorkflowImageProvider", () => {
  const originalSeedToken = process.env.LEMO_COZE_SEED_API_TOKEN;
  const originalSeedRunUrl = process.env.LEMO_COZE_SEED_RUN_URL;

  afterEach(() => {
    if (originalSeedToken === undefined) {
      delete process.env.LEMO_COZE_SEED_API_TOKEN;
    } else {
      process.env.LEMO_COZE_SEED_API_TOKEN = originalSeedToken;
    }

    if (originalSeedRunUrl === undefined) {
      delete process.env.LEMO_COZE_SEED_RUN_URL;
    } else {
      process.env.LEMO_COZE_SEED_RUN_URL = originalSeedRunUrl;
    }

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls coze workflow run API with normalized payload", async () => {
    process.env.LEMO_COZE_SEED_API_TOKEN = "seed-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: {
            output: [
              {
                url: "https://example.com/generated/output.png",
              },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozeWorkflowImageProvider({
      providerId: "coze",
      modelId: "coze_seedream4_5",
      apiKey: "legacy-token",
      baseURL: "https://custom.coze.site/run",
    });

    const result = await provider.generateImage({
      prompt: "一只蓝色的猫坐在窗边",
      width: 1024,
      height: 1536,
      images: ["https://example.com/reference.jpg"],
    });

    expect(result.images).toEqual(["https://example.com/generated/output.png"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://custom.coze.site/run");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer seed-token",
    });

    const body = JSON.parse(String(options?.body));
    expect(body).toEqual({
      prompt: "一只蓝色的猫坐在窗边",
      reference_images: ["https://example.com/reference.jpg"],
      size: "1024x1536",
      watermark: false,
    });
  });

  it("falls back to LEMO_COZE_SEED_RUN_URL and extracts coze short urls", async () => {
    process.env.LEMO_COZE_SEED_API_TOKEN = "seed-token";
    process.env.LEMO_COZE_SEED_RUN_URL = "https://seed-workflow.coze.site/run";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          message: {
            content: "image: https://s.coze.cn/t/AbCdEf123_-/",
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozeWorkflowImageProvider({
      providerId: "coze",
      modelId: "coze_seedream4_5",
      apiKey: "legacy-token",
      baseURL: "https://bot-open-api.bytedance.net/v3/chat",
    });

    const result = await provider.generateImage({
      prompt: "",
      imageSize: "2K",
    });

    expect(result.images).toEqual(["https://s.coze.cn/t/AbCdEf123_-/"]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://seed-workflow.coze.site/run");

    const body = JSON.parse(String(options?.body));
    expect(body.reference_images).toEqual([]);
    expect(body.size).toBe("2048x2048");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer seed-token",
    });
  });

  it("getProvider resolves LEMO_COZE_SEED_API_TOKEN for the workflow model", async () => {
    process.env.LEMO_COZE_SEED_API_TOKEN = "seed-env-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { image: "https://example.com/final.webp" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const providers: APIProviderConfig[] = [
      {
        id: "provider-coze-seed",
        name: "Coze Workflow (Seedream 4.5)",
        providerType: "coze-image",
        apiKey: "",
        baseURL: "https://2q3rqt6rnh.coze.site/run",
        models: [
          {
            modelId: "coze_seedream4_5",
            displayName: "Seedream 4.5",
            task: ["image"],
          },
        ],
        isEnabled: true,
        createdAt: "2026-03-06T00:00:00.000Z",
        updatedAt: "2026-03-06T00:00:00.000Z",
      },
    ];

    const provider = getProvider("coze_seedream4_5", undefined, providers);
    if (!("generateImage" in provider)) {
      throw new Error("Expected image provider");
    }

    await provider.generateImage({ prompt: "test prompt" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer seed-env-token",
    });
  });

  it("passes base64 reference images as string array and reads generated_image_urls", async () => {
    process.env.LEMO_COZE_SEED_API_TOKEN = "seed-token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          generated_image_urls: ["https://example.com/generated/from-schema.jpeg"],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozeWorkflowImageProvider({
      providerId: "coze",
      modelId: "coze_seedream4_5",
      apiKey: "legacy-token",
      baseURL: "https://custom.coze.site/run",
    });

    const result = await provider.generateImage({
      prompt: "flat icon",
      image: "data:image/png;base64,AAAA",
      imageSize: "2K",
    });

    expect(result.images).toEqual(["https://example.com/generated/from-schema.jpeg"]);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.reference_images).toEqual(["data:image/png;base64,AAAA"]);
    expect(body.size).toBe("2048x2048");
  });

  it("inlines storage-backed reference image URLs before calling Coze workflow", async () => {
    process.env.LEMO_COZE_SEED_API_TOKEN = "seed-token";

    const storageProxyUrl =
      "http://127.0.0.1:3001/api/storage/image?key=ljhwZthlaukjlkulzlp%2Fgallery%2Freference.png";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === storageProxyUrl) {
        return new Response(
          Uint8Array.from(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")),
          {
            status: 200,
            headers: {
              "content-type": "image/png",
            },
          },
        );
      }

      return {
        ok: true,
        status: 200,
        headers: init?.headers,
        text: async () =>
          JSON.stringify({
            data: {
              output: [
                {
                  url: "https://example.com/generated/output.png",
                },
              ],
            },
          }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CozeWorkflowImageProvider({
      providerId: "coze",
      modelId: "coze_seedream4_5",
      apiKey: "legacy-token",
      baseURL: "https://custom.coze.site/run",
    });

    const result = await provider.generateImage({
      prompt: "rerun with gallery reference",
      width: 1024,
      height: 1024,
      images: [storageProxyUrl],
    });

    expect(result.images).toEqual(["https://example.com/generated/output.png"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, options] = fetchMock.mock.calls[1];
    const body = JSON.parse(String(options?.body));
    expect(body.reference_images).toHaveLength(1);
    expect(String(body.reference_images[0])).toMatch(/^data:image\/png;base64,/);
  });
});
