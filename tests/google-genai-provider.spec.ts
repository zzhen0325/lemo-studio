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
});
