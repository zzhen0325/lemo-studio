import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAbsoluteSiteUrl, getConfiguredSiteBaseUrl, readLocalPublicImage } from "@/lib/ai/imageInput";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX6sAAAAASUVORK5CYII=";

describe("imageInput relative path resolution", () => {
  afterEach(() => {
    delete window.__LEMO_RUNTIME_ENV__;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prefers NEXT_PUBLIC_BASE_URL when building absolute site URLs", () => {
    window.__LEMO_RUNTIME_ENV__ = {
      baseUrl: "https://pr62hkr9.fn-boe.bytedance.net",
      apiBase: "https://qzcnzen0.fn-boe.bytedance.net/api",
    };

    expect(getConfiguredSiteBaseUrl()).toBe("https://pr62hkr9.fn-boe.bytedance.net");
    expect(buildAbsoluteSiteUrl("/outputs/test.png")).toBe("https://pr62hkr9.fn-boe.bytedance.net/outputs/test.png");
  });

  it("falls back to fetching the relative path from the configured site base", async () => {
    window.__LEMO_RUNTIME_ENV__ = {
      baseUrl: "https://pr62hkr9.fn-boe.bytedance.net",
    };

    const fetchMock = vi.fn().mockResolvedValue(new Response(
      Uint8Array.from(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")),
      {
        status: 200,
        headers: {
          "content-type": "image/png",
        },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readLocalPublicImage("/outputs/missing-runtime-only.png");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://pr62hkr9.fn-boe.bytedance.net/outputs/missing-runtime-only.png",
      { cache: "no-store" },
    );
    expect(result?.mimeType).toBe("image/png");
    expect(result?.data).toBe(ONE_PIXEL_PNG_BASE64);
  });
});
