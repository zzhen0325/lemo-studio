import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { GoogleGenAIProvider } from "@/lib/ai/providers";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX6sAAAAASUVORK5CYII=";

const workspaceRoot = process.cwd();
const relativeImagePath = "/outputs/test-google-genai-provider.png";
const absoluteImagePath = path.join(
  workspaceRoot,
  "public",
  "outputs",
  "test-google-genai-provider.png"
);

describe("GoogleGenAIProvider", () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(absoluteImagePath), { recursive: true });
    await fs.writeFile(
      absoluteImagePath,
      Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
    );
  });

  afterEach(async () => {
    await fs.rm(absoluteImagePath, { force: true });
    delete window.__LEMO_RUNTIME_ENV__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("encodes local public image paths before calling Google", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: ONE_PIXEL_PNG_BASE64,
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleGenAIProvider({
      providerId: "google",
      modelId: "gemini-2.5-flash-image",
      apiKey: "test-key",
    });

    await provider.generateImage({
      prompt: "Turn this into watercolor",
      image: relativeImagePath,
      images: [relativeImagePath],
      aspectRatio: "1:1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    const imagePart = body.contents[0].parts[0].inline_data;

    expect(imagePart.mime_type).toBe("image/png");
    expect(imagePart.data).toBe(ONE_PIXEL_PNG_BASE64);
    expect(imagePart.data).not.toBe(relativeImagePath);
  });

  it("falls back to NEXT_PUBLIC_BASE_URL for relative image paths missing from local public", async () => {
    window.__LEMO_RUNTIME_ENV__ = {
      baseUrl: "https://pr62hkr9.fn-boe.bytedance.net",
    };

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://pr62hkr9.fn-boe.bytedance.net/outputs/runtime-only.png") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "image/png" }),
          arrayBuffer: async () => Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"),
        };
      }

      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inline_data: {
                      mime_type: "image/png",
                      data: ONE_PIXEL_PNG_BASE64,
                    },
                  },
                ],
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleGenAIProvider({
      providerId: "google",
      modelId: "gemini-2.5-flash-image",
      apiKey: "test-key",
    });

    await provider.generateImage({
      prompt: "Turn this into watercolor",
      image: "/outputs/runtime-only.png",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://pr62hkr9.fn-boe.bytedance.net/outputs/runtime-only.png",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
